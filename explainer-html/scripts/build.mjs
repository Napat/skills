import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({absWorkingDir:root,entryPoints:['src/cli.mjs'], bundle:true, platform:'node', format:'esm', target:'node22', write:false, legalComments:'inline', banner:{js:'#!/usr/bin/env node\nimport {createRequire} from "node:module";const require=createRequire(import.meta.url);'}, packages:'bundle'});
const file=path.join(root,'scripts/render.mjs'), bytes=result.outputFiles[0].contents;
const digest=b=>createHash('sha256').update(b).digest('hex');
const inputs=['scripts/build.mjs','package.json','package-lock.json',...fs.readdirSync(path.join(root,'src')).filter(n=>n.endsWith('.mjs')).map(n=>'src/'+n),...fs.readdirSync(path.join(root,'assets')).map(n=>'assets/'+n)].sort();
const manifest=JSON.stringify({version:1,bundle:digest(bytes),inputs:Object.fromEntries(inputs.map(name=>[name,digest(fs.readFileSync(path.join(root,name)))]))},null,2)+'\n';
const manifestFile=path.join(root,'scripts/build-manifest.json');
if(process.argv.includes('--check')) {
  if(!fs.existsSync(file)||!Buffer.from(bytes).equals(fs.readFileSync(file))||!fs.existsSync(manifestFile)||fs.readFileSync(manifestFile,'utf8')!==manifest) {console.error('CLI bundle or manifest differs from source. Run npm run build.'); process.exitCode=1;}
  else console.log('CLI bundle matches source');
} else {fs.writeFileSync(file,bytes,{mode:0o755});fs.writeFileSync(manifestFile,manifest);console.log('Built scripts/render.mjs and source manifest');}
