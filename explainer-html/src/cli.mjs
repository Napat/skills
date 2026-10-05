import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { VERSION, atomicWrite, ExplainError } from './util.mjs';
import { cacheRoot, makeRun, finishRun, collect } from './cache.mjs';
import { prepare, compose } from './compile.mjs';
import { narration } from './tts.mjs';
import { enqueue, status, cancel, resume, worker } from './jobs.mjs';

const help=`Explainer HTML ${VERSION}
node <skill>/scripts/render.mjs render [spec.md] --engine archify --theme shadcn --mode auto [--voice auto] [--save page.html] [--json]
node <skill>/scripts/render.mjs export page.html --format mp4 [--save movie.mp4] [--json]
node <skill>/scripts/render.mjs status|cancel|resume <job-id> [--json]
node <skill>/scripts/render.mjs gc [--json]
Without a spec path, render reads stdin. Outputs default to an owned temporary cache.
resume verifies the snapshot and completed frames, then continues a stopped export.
`;
async function main(){
  const {values,positionals}=parseArgs({allowPositionals:true,options:{engine:{type:'string',default:'archify'},theme:{type:'string'},mode:{type:'string'},voice:{type:'string'},save:{type:'string'},format:{type:'string',default:'mp4'},json:{type:'boolean'},help:{type:'boolean'},version:{type:'boolean'}}});
  if(values.help){console.log(help);return;}if(values.version){console.log(VERSION);return;}
  const command=positionals.shift()||'render',root=cacheRoot();
  function print(value){if(values.json)console.log(JSON.stringify(value));else if(value.html)console.log(`${value.html}\nValidation: ${value.validation.structural}; narration: ${value.provider}${value.warnings?.length?'\n'+value.warnings.join('\n'):''}`);else console.log(JSON.stringify(value,null,2));}
  if(command==='_worker'){await worker(root,positionals[0]);return;}
  if(command==='gc'){print(collect(root));return;}
  if(['status','cancel','resume'].includes(command)){print(({status,cancel,resume})[command](root,positionals[0]||''));return;}
  if(command==='export'){if(values.format!=='mp4')throw new Error('Only MP4 export is supported');if(!positionals[0])throw new Error('Provide the generated HTML path');print(enqueue(root,path.resolve(positionals[0]),{save:values.save}));return;}
  if(command!=='render')throw new Error(`Unknown command ${command}; use --help`);
  if(values.engine!=='archify')throw new Error('Only the pinned Archify engine is supported');
  if(values.save&&path.extname(values.save).toLowerCase()!=='.html')throw new Error('--save must end in .html');
  if(values.save&&path.resolve(values.save).startsWith(root+path.sep))throw new Error('--save must be outside the temporary cache');
  collect(root);const run=makeRun(root);let partial;
  try{
    const source=fs.readFileSync(positionals[0]?path.resolve(positionals[0]):0,'utf8');atomicWrite(path.join(run.dir,'source.md'),source);
    const prepared=await prepare(source,{dir:run.dir,overrides:{theme:values.theme,mode:values.mode,voice:values.voice}});
    // Preserve an openable caption preview before any provider call.
    const previewMedia=await narration({...prepared.doc,meta:{...prepared.doc.meta,voice:'off'}},root);
    partial=compose(prepared,previewMedia);const preview=path.join(run.dir,'preview.html');atomicWrite(preview,partial.html);
    let media;
    try{media=await narration(prepared.doc,root);}catch(e){e.preview=preview;throw e;}
    const result=compose(prepared,media),file=values.save?path.resolve(values.save):path.join(run.dir,'explanation.html');atomicWrite(file,result.html);
    const receipt={id:run.id,html:file,preview,source:path.join(run.dir,'source.md'),persistent:Boolean(values.save),provider:media.provider,duration:prepared.doc.meta.video?media.timeline.duration:null,warnings:result.data.warnings,validation:result.validation};atomicWrite(path.join(run.dir,'result.json'),JSON.stringify(receipt,null,2));run.meta.html=file;finishRun(run);print(receipt);
  }catch(e){finishRun(run,'failed');throw e;}
}
main().catch(e=>{const value={error:e.message,...(e instanceof ExplainError?{code:e.code,line:e.line,component:e.component,hint:e.hint}:{}),...(e.preview?{preview:e.preview}:{})};if(process.argv.includes('--json'))console.log(JSON.stringify(value));else console.error(`${value.component?`${value.component}:${value.line}: `:''}${e.message}${e.hint?'\n'+e.hint:''}${e.preview?'\nCaption preview: '+e.preview:''}`);process.exitCode=1;});
