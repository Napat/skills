import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { ROOT, atomicWrite, hash, run, fail } from './util.mjs';
import { writeManifest, readManifest, alive } from './cache.mjs';
import { inspectHtml } from './compile.mjs';
import { openBrowser } from './browser.mjs';

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function jobDir(root,id){if(!ID.test(id))fail('Invalid job ID',{component:'export'});const dir=path.join(root,'jobs',id);if(!fs.existsSync(dir)||!fs.lstatSync(dir).isDirectory())fail('Job not found',{component:'export'});return dir;}
export function status(root,id){
  const dir=jobDir(root,id),m=readManifest(dir);if(m?.owner!=='explainer-html'||m.id!==id)fail('Invalid job manifest',{component:'export'});
  if(['queued','running'].includes(m.status)&&!alive(m.pid)){m.status='interrupted';m.error='Worker stopped. Resume this job to reuse completed frames.';m.lastUsed=Date.now();writeManifest(dir,m);}
  return {...m,jobDir:dir,canResume:['interrupted','failed','cancelled'].includes(m.status)};
}
function startWorker(root,dir,m){
  const lock=path.join(dir,'dispatch.lock');let fd;
  try{fd=fs.openSync(lock,'wx',0o600);fs.writeFileSync(fd,String(process.pid));}catch(e){if(e.code==='EEXIST'){const pid=Number(fs.readFileSync(lock,'utf8'));if(alive(pid))throw new Error('This job is already being dispatched');fs.unlinkSync(lock);return startWorker(root,dir,m);}throw e;}
  try{
    if(['queued','running'].includes(m.status)&&alive(m.pid))throw new Error('Job is already active');
    // The worker only needs browser/encoder configuration, never speech credentials.
    const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG','LC_ALL','EXPLAINER_HTML_CHROME','EXPLAINER_HTML_FFMPEG','EXPLAINER_HTML_EXPORT_TIMEOUT'].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));env.EXPLAINER_HTML_CACHE_DIR=root;
    const log=fs.openSync(path.join(dir,'worker.log'),'a',0o600);
    m={...m,status:'queued',pid:process.pid,lastUsed:Date.now(),attempt:(m.attempt||0)+1,error:null};writeManifest(dir,m);
    const child=spawn(process.execPath,[path.join(ROOT,'scripts/render.mjs'),'_worker',m.id],{detached:true,stdio:['ignore',log,log],env});fs.closeSync(log);child.unref();m.pid=child.pid;writeManifest(dir,m);return m;
  }finally{if(fd!==undefined)fs.closeSync(fd);fs.rmSync(lock,{force:true});}
}
export function enqueue(root,file,{save}={}){
  const html=fs.readFileSync(file,'utf8'),{data}=inspectHtml(html);
  if(!data.meta.video)fail('MP4 requires video: on',{component:'export'});
  const id=randomUUID(),dir=path.join(root,'jobs',id);fs.mkdirSync(dir,{mode:0o700});fs.mkdirSync(path.join(dir,'frames'));
  const snapshot=path.join(dir,'snapshot.html');atomicWrite(snapshot,html);
  const duration=data.timeline.duration,totalFrames=Math.ceil(duration*30);
  if(!Number.isFinite(duration)||duration<=0||duration>3600)fail('Export duration must be between 0 and 3600 seconds',{component:'export'});
  const output=save?path.resolve(save):path.join(dir,'output.mp4');if(path.extname(output).toLowerCase()!=='.mp4')fail('MP4 output must end in .mp4',{component:'export'});
  if(save&&output.startsWith(root+path.sep))fail('--save must be outside the temporary cache',{component:'export'});
  const m={owner:'explainer-html',id,status:'created',pid:null,created:Date.now(),lastUsed:Date.now(),source:path.resolve(file),snapshot,snapshotHash:hash(html),output,persistent:Boolean(save),duration,totalFrames,nextFrame:0,phase:'frames',fps:30,width:1920,height:1080};
  writeManifest(dir,m);return {...startWorker(root,dir,m),jobDir:dir};
}
export function resume(root,id){const m=status(root,id);if(!m.canResume)fail('Only interrupted, failed or cancelled jobs can resume',{component:'export'});const html=fs.readFileSync(m.snapshot,'utf8');if(hash(html)!==m.snapshotHash)fail('Job snapshot changed; start a new export',{component:'export'});inspectHtml(html);return {...startWorker(root,m.jobDir,m),jobDir:m.jobDir};}
export function cancel(root,id){const m=status(root,id);if(!['queued','running'].includes(m.status))return m;const stop=path.join(m.jobDir,'cancel');atomicWrite(stop,'cancel\n');
  // Signal the isolated worker group only; Chromium and encoder receive the same cancellation.
  try{process.kill(-m.pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;}m.status='cancelled';m.lastUsed=Date.now();writeManifest(m.jobDir,m);return m;
}
export async function worker(root,id){
  const dir=jobDir(root,id);let m=readManifest(dir);const controller=new AbortController();let browser,stopped=false;
  const abort=()=>{stopped=true;controller.abort();};process.on('SIGTERM',abort);process.on('SIGINT',abort);
  // Wait for the parent to publish our PID before replacing the manifest.
  for(let i=0;i<100&&m.pid!==process.pid;i++){await new Promise(r=>setTimeout(r,20));m=readManifest(dir);}
  if(m.pid!==process.pid)throw new Error('Export dispatch did not complete');
  if(m.status==='cancelled'||stopped)return m;
  fs.rmSync(path.join(dir,'cancel'),{force:true});m={...m,status:'running',pid:process.pid,lastUsed:Date.now()};writeManifest(dir,m);
  const deadline=Date.now()+Number(process.env.EXPLAINER_HTML_EXPORT_TIMEOUT||1800)*1000;
  const check=()=>{if(stopped||fs.existsSync(path.join(dir,'cancel')))throw new Error('Export cancelled');if(Date.now()>deadline)throw new Error('Export timed out; resume to continue from its checkpoint');};
  const persist=()=>{m.lastUsed=Date.now();writeManifest(dir,m);};
  try{
    check();const html=fs.readFileSync(m.snapshot,'utf8');if(hash(html)!==m.snapshotHash)throw new Error('Immutable snapshot hash mismatch');const {data}=inspectHtml(html);
    const frameDir=path.join(dir,'frames'),journal=path.join(dir,'frames.jsonl');
    const hashes=new Map();try{for(const line of fs.readFileSync(journal,'utf8').trim().split('\n')){try{const r=JSON.parse(line);hashes.set(r.index,r.hash);}catch{}}}catch{}
    let next=0;for(;next<m.totalFrames;next++){const p=path.join(frameDir,`${String(next).padStart(8,'0')}.png`);try{if(!fs.lstatSync(p).isFile()||hash(fs.readFileSync(p))!==hashes.get(next))break;}catch{break;}}
    m.nextFrame=next;m.phase='frames';persist();
    if(next<m.totalFrames){
      const profile=path.join(dir,`browser-${randomUUID()}`);browser=await openBrowser(m.snapshot,profile,{signal:controller.signal});
      try{for(let i=next;i<m.totalFrames;i++){check();const buffer=await browser.frame(i/30),file=path.join(frameDir,`${String(i).padStart(8,'0')}.png`);atomicWrite(file,buffer);fs.appendFileSync(journal,JSON.stringify({index:i,hash:hash(buffer)})+'\n',{mode:0o600});m.nextFrame=i+1;if(i%15===0||i===m.totalFrames-1)persist();}}
      finally{await browser.close();browser=null;fs.rmSync(profile,{recursive:true,force:true});}
    }
    check();m.phase='encode';persist();
    const audio=path.join(dir,'audio.wav');if(data.audio){if(!data.audio.startsWith('data:audio/wav;base64,'))throw new Error('Invalid embedded audio');atomicWrite(audio,Buffer.from(data.audio.split(',')[1],'base64'));}
    const temp=path.join(dir,'encoding.mp4'),args=['-hide_banner','-loglevel','error','-y','-framerate','30','-i',path.join(frameDir,'%08d.png'),...(data.audio?['-i',audio]:['-f','lavfi','-i','anullsrc=channel_layout=mono:sample_rate=22050']),'-t',String(m.duration),'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',temp];
    await run(process.env.EXPLAINER_HTML_FFMPEG||'ffmpeg',args,{timeout:Math.max(1000,deadline-Date.now()),signal:controller.signal});check();
    // Commit only a complete encoded file; a failed export cannot damage a saved MP4.
    atomicWrite(m.output,fs.readFileSync(temp));fs.rmSync(temp,{force:true});m.status='completed';m.phase='complete';m.completed=Date.now();persist();
  }catch(e){m.status=stopped||fs.existsSync(path.join(dir,'cancel'))?'cancelled':'failed';m.error=e.message;m.phase=m.phase||'frames';persist();}
  finally{await browser?.close();process.off('SIGTERM',abort);process.off('SIGINT',abort);}
  return m;
}
