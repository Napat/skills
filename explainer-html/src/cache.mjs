import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicWrite } from './util.mjs';

export const TTL = 72 * 60 * 60 * 1000;
export const MAX_BYTES = 512 * 1024 * 1024;
export const alive = pid => {try {if(!Number.isInteger(pid)||pid<1)return false;process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}};
export function cacheRoot(env=process.env) {
  const root=path.resolve(env.EXPLAINER_HTML_CACHE_DIR || path.join(os.tmpdir(),`explainer-html-${process.getuid?.() ?? 'user'}`));
  if(fs.existsSync(root)&&!fs.lstatSync(root).isDirectory())throw new Error('Cache root must be a real directory, not a symlink');
  fs.mkdirSync(root,{recursive:true,mode:0o700});
  const marker=path.join(root,'.explainer-html-cache');
  if(!fs.existsSync(marker)) {
    if(fs.readdirSync(root).length)throw new Error('Choose an empty cache directory; this directory is not owned by explainer-html');
    try {fs.writeFileSync(marker,'explainer-html-cache-v1\n',{flag:'wx',mode:0o600});} catch(e) {if(e.code!=='EEXIST')throw e;}
  }
  if(!fs.lstatSync(marker).isFile()||fs.readFileSync(marker,'utf8')!=='explainer-html-cache-v1\n')throw new Error('Invalid cache ownership marker');
  for(const name of ['runs','audio','jobs']) {
    const p=path.join(root,name);if(fs.existsSync(p)&&!fs.lstatSync(p).isDirectory())throw new Error(`Cache ${name} must not be a symlink`);
    fs.mkdirSync(p,{recursive:true,mode:0o700});
  }
  return root;
}
export function writeManifest(dir,value) {atomicWrite(path.join(dir,'manifest.json'),JSON.stringify(value,null,2)+'\n');}
export function readManifest(dir) {try {const p=path.join(dir,'manifest.json');if(!fs.lstatSync(p).isFile())return null;return JSON.parse(fs.readFileSync(p,'utf8'));}catch{return null;}}
export function makeRun(root) {
  const id=randomUUID(),dir=path.join(root,'runs',id);fs.mkdirSync(dir,{mode:0o700});
  const meta={owner:'explainer-html',id,status:'running',pid:process.pid,lastUsed:Date.now()};writeManifest(dir,meta);return {id,dir,meta};
}
export function finishRun(run,status='completed') {run.meta={...run.meta,status,lastUsed:Date.now()};writeManifest(run.dir,run.meta);}
export function sizeOf(p) {
  const s=fs.lstatSync(p);if(s.isSymbolicLink())return 0;
  if(s.isFile())return s.size;
  if(s.isDirectory())return fs.readdirSync(p).reduce((sum,name)=>sum+sizeOf(path.join(p,name)),0);
  return 0;
}
export function collect(root,{now=Date.now(),ttl=TTL,maxBytes=MAX_BYTES,dryRun=false}={}) {
  const entries=[];let protectedBytes=0;
  for(const kind of ['runs','jobs']) for(const name of fs.readdirSync(path.join(root,kind))) {
    const p=path.join(root,kind,name);if(!fs.lstatSync(p).isDirectory())continue;
    const m=readManifest(p);if(m?.owner!=='explainer-html')continue;
    const bytes=sizeOf(p),protectedEntry=['running','queued'].includes(m.status)&&alive(m.pid);
    if(protectedEntry)protectedBytes+=bytes;
    else entries.push({path:p,bytes,lastUsed:Number(m.lastUsed)||0});
  }
  for(const name of fs.readdirSync(path.join(root,'audio'))) {
    if(!/^[a-f0-9]{64}\.wav$/.test(name))continue;
    const p=path.join(root,'audio',name),s=fs.lstatSync(p);if(s.isFile())entries.push({path:p,bytes:s.size,lastUsed:s.mtimeMs});
  }
  entries.sort((a,b)=>a.lastUsed-b.lastUsed);let bytes=protectedBytes+entries.reduce((n,e)=>n+e.bytes,0);const removed=[];
  for(const e of entries) if(now-e.lastUsed>ttl||bytes>maxBytes) {
    if(!dryRun)fs.rmSync(e.path,{recursive:true,force:true});bytes-=e.bytes;removed.push(e.path);
  }
  return {removed,bytes,protectedBytes,dryRun};
}
