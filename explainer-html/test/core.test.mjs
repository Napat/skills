import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { parse } from '../src/parse.mjs';
import { renderSimple, markdown } from '../src/components.mjs';
import { ranks, layoutGraph, renderDiagram } from '../src/diagram.mjs';
import { prepare, compose, inspectHtml } from '../src/compile.mjs';
import { cacheRoot, collect, makeRun, finishRun } from '../src/cache.mjs';
import { wav, decodeWav, RATE, narration, localProvider, requestSpeech } from '../src/tts.mjs';
import { ROOT, hash, run, atomicWrite } from '../src/util.mjs';

const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'explainer-html-test-'));
function fixture(name){return fs.readFileSync(path.join(ROOT,'examples',name+'.md'),'utf8');}
async function compile(source){const dir=temp(),root=cacheRoot({EXPLAINER_HTML_CACHE_DIR:path.join(dir,'cache')});try{const p=await prepare(source,{dir}),m=await narration({...p.doc,meta:{...p.doc.meta,voice:'off'}},root);return compose(p,m);}finally{fs.rmSync(dir,{recursive:true,force:true});}}

test('frontmatter and semantic source locations reject ambiguous input',()=>{
  assert.equal(parse('---\ntitle: เรื่องทดสอบ\n---\n## บท\n\nคำอธิบาย').meta.lang,'th');
  assert.throws(()=>parse('---\nschema: 2\n---\nhello'),/Unsupported schema/);
  assert.throws(()=>parse('---\ntitle: a\ntitle: b\n---\n'),/unique/);
  assert.throws(()=>parse('---\ntitle: &x A\nsubtitle: *x\n---\n'),/aliases/);
  assert.throws(()=>parse('---\nvideo: on\n---\n## Scene\nHello'),/beats/);
  const p=parse('## One\n\n```tree\n- label: Root\n```\n');assert.equal(p.sections[0].blocks.find(b=>b.kind==='tree').line,4);
});
test('annotation anchors disambiguate repeated text and reject overlap',()=>{
  const make=notes=>renderSimple({kind:'annot',line:5,value:{text:'foo foo bar',notes}},'c1');
  assert.throws(()=>make([{quote:'foo',note:'x'}]),/occurrence/);
  assert.match(make([{quote:'foo',occurrence:2,note:'<script>x</script>'}]).html,/foo <button/);
  assert.throws(()=>make([{quote:'foo bar',note:'x'},{quote:'bar',note:'y'}]),/overlap/);
  assert.throws(()=>make([{quote:'missing',note:'x'}]),/not found/);
});
test('status markers do not rewrite code or link targets',()=>{
  const html=markdown('`[✓]`\n\n[link](https://example.com/[!])\n\n[✓] supported\n\n```text\n[✗]\n```');
  assert.match(html,/<code>\[✓\]<\/code>/);assert.match(html,/href="https:\/\/example.com\/\[!\]"/);assert.match(html,/class="code-line">\[✗\]/);assert.equal((html.match(/class="status /g)||[]).length,1);
});
test('SCC layout keeps every node in cycles, branches and nested groups',()=>{
  const nodes=['a','b','c','d','e'].map(id=>({id,label:id==='e'?'ข้อมูลภาษาไทยที่มีชื่อยาวมากและแสดงครบถ้วน':'Duplicate'}));
  const edges=[{from:'a',to:'b'},{from:'a',to:'c'},{from:'b',to:'d'},{from:'c',to:'d'},{from:'d',to:'b'},{from:'d',to:'e'}];
  const out=layoutGraph(nodes,edges,[{id:'outer',members:['b','c']},{id:'inner',parent:'outer',members:['d','e']}]);
  assert.equal(out.boxes.size,5);assert.equal(out.bounds.length,2);
  for(const [id,a]of out.boxes)for(const [other,b]of out.boxes)if(id!==other)assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
  assert.equal(ranks(nodes.map(n=>n.id),edges).size,5);
  assert.throws(()=>layoutGraph(nodes,edges,[{id:'x',parent:'y'},{id:'y',parent:'x'}]),/cycle/);
});
test('Archify renders cyclic nested topology without dropping edges',async()=>{
  const dir=temp();try{
    const block={kind:'flow',line:1,value:{nodes:{a:{label:'入口'},b:{label:'Duplicate'},c:{label:'Duplicate'},d:{label:'ฐานข้อมูลภาษาไทยชื่อยาว',kind:'database'}},edges:[{id:'ab',from:'a',to:'b',label:'start'},{id:'ac',from:'a',to:'c',label:'branch'},{id:'bd',from:'b',to:'d',label:'write'},{id:'dc',from:'d',to:'c',label:'retry'},{id:'cb',from:'c',to:'b',label:'cycle'}],groups:[{id:'outer',label:'Outer',members:['b']},{id:'inner',label:'Inner',parent:'outer',members:['c','d']}]}};
    const out=await renderDiagram(block,{dir,prefix:'cycle',lang:'th',title:'Cycle'});
    assert.equal(out.report.nodes,4);assert.equal(out.report.edges,5);for(const id of ['ab','ac','bd','dc','cb'])assert.ok(out.html.includes(`data-entity="${id}"`));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('cache-hit return labels clear components without losing topology or duplicate labels',async()=>{
  const original=fixture('cache-hit');
  for(const source of [original,original.replace('4. Response 200 OK (JSON)','1. Request (GET /products/101)')]){
    const out=await compile(source),diagram=out.validation.diagrams[0];
    assert.equal(out.validation.structural,'passed');
    assert.equal(diagram.nodes,4);assert.equal(diagram.edges,4);assert.ok(diagram.attempts<=3);
    for(const id of ['client','api','redis','db','request','lookup','hit','response'])assert.ok(out.html.includes(`data-entity="${id}"`),id);
    assert.equal(inspectHtml(out.html).data.source,source);
  }
});
test('composed documents include all components, inline data and isolated SVG IDs',async()=>{
  for(const name of ['architecture','sequence','components','thai-video']){
    const out=await compile(fixture(name));assert.equal(out.validation.structural,'passed');assert.equal(inspectHtml(out.html).data.source,fixture(name));
    assert.doesNotMatch(out.html,/<script[^>]+src=|<link\b|<iframe\b/);
  }
  const out=await compile('## A\n```architecture\nnodes: {a: {label: A}, b: {label: B}}\nedges: [{from: a, to: b}]\n```\n## B\n```architecture\nnodes: {a: {label: A}, b: {label: B}}\nedges: [{from: a, to: b}]\n```');assert.ok(out.validation.diagrams.length===2);
});
test('unknown targets and malicious content cannot become executable markup',async()=>{
  await assert.rejects(()=>compile('## A\n```architecture\nnodes: {a: {label: A}}\nedges: [{from: a, to: missing}]\n```'),/Unknown endpoint/);
  await assert.rejects(()=>compile('---\nvideo: on\n---\n## A\n```beats\n- {narration: Hello, focus: [missing]}\n```'),/missing ID/);
  const out=await compile('## A\n<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)\n\n```js\n</script><img src=x onerror=alert(1)>\n```');
  assert.match(out.html,/&lt;script&gt;/);assert.doesNotMatch(out.html,/<img src=x|href="javascript:/);assert.equal(inspectHtml(out.html).data.source.includes('</script>'),true);
  assert.throws(()=>inspectHtml(out.html.replace('</head>','<script>alert(1)</script></head>')),/Unexpected script/);
});
test('WAV conversion and timing use measured sample lengths',async()=>{
  const samples=Int16Array.from({length:RATE},(_,i)=>Math.sin(i/10)*2000),encoded=wav(samples);assert.equal(decodeWav(encoded).length,RATE);assert.throws(()=>decodeWav(Buffer.alloc(44)),/Expected/);
  const dir=temp(),root=cacheRoot({EXPLAINER_HTML_CACHE_DIR:path.join(dir,'cache')});let calls=0;
  try{const doc=parse(fixture('thai-video'));const providers={system:()=>({identity:'test',synth:async()=>{calls++;return samples;}})};doc.meta.voice='system';const a=await narration(doc,root,{providers});const b=await narration(doc,root,{providers});assert.equal(calls,3);assert.equal(a.provider,'system');assert.deepEqual(a.audio,b.audio);assert.equal(a.timeline.scenes[0].beats[0].end-a.timeline.scenes[0].beats[0].start,1);assert.ok(Math.abs(decodeWav(a.audio).length/RATE-a.timeline.duration)<.001);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('local TTS contract and provider fallback expose outcomes without credentials',async()=>{
  const secret='private-test-value',requests=[],pcm=wav(new Int16Array(RATE/2).fill(100));
  const fetchImpl=async(url,options)=>{requests.push({url:String(url),...options});return new Response(pcm,{status:200});};
  const provider=localProvider({EXPLAINER_HTML_TTS_URL:'http://localhost:9880',EXPLAINER_HTML_TTS_API_KEY:secret,EXPLAINER_HTML_TTS_MODEL:'local-tts',EXPLAINER_HTML_TTS_VOICE:'th'},'th',fetchImpl);
  assert.equal((await provider.synth('ทดสอบ')).length,RATE/2);assert.equal(requests[0].url,'http://localhost:9880/v1/audio/speech');assert.equal(JSON.parse(requests[0].body).response_format,'wav');assert.equal(requests[0].headers.Authorization,`Bearer ${secret}`);assert.ok(!provider.identity.includes(secret));
  await assert.rejects(()=>requestSpeech('http://localhost',{}, {fetchImpl:async()=>new Response('',{status:429})}),/429/);
  await assert.rejects(()=>requestSpeech('http://localhost',{}, {fetchImpl:async()=>{throw new Error(secret);}}),e=>!e.message.includes(secret));
  const dir=temp(),root=cacheRoot({EXPLAINER_HTML_CACHE_DIR:path.join(dir,'cache')});try{const doc=parse(fixture('thai-video'));const out=await narration(doc,root,{providers:{elevenlabs:()=>{throw new Error('unavailable');},local:()=>null,system:()=>null}});assert.equal(out.provider,'captions');assert.match(out.warnings.join(' '),/elevenlabs.*captions/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('ElevenLabs selects a language-capable model and requests PCM',async()=>{
  const dir=temp(),root=cacheRoot({EXPLAINER_HTML_CACHE_DIR:path.join(dir,'cache')}),requests=[];try{
    const doc=parse(fixture('thai-video'));doc.meta.voice='elevenlabs';
    const fetchImpl=async(url,options)=>{requests.push({url,options});return url.endsWith('/models')?Response.json([{model_id:'english_only',can_do_text_to_speech:true,languages:[{language_id:'en'}]},{model_id:'thai_capable',can_do_text_to_speech:true,languages:[{language_id:'th'}]}]):new Response(Buffer.alloc(RATE*2));};
    const result=await narration(doc,root,{env:{ELEVENLABS_API_KEY:'test-key'},fetchImpl});assert.equal(result.provider,'elevenlabs');assert.equal(JSON.parse(requests[1].options.body).model_id,'thai_capable');assert.match(requests[1].url,/output_format=pcm_22050/);assert.doesNotMatch(JSON.stringify(result.timeline),/test-key/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('cache eviction protects active jobs and saved files, never follows symlinks',()=>{
  const dir=temp(),root=cacheRoot({EXPLAINER_HTML_CACHE_DIR:path.join(dir,'cache')});try{
    assert.equal(cacheRoot({EXPLAINER_HTML_CACHE_DIR:root}),root);const active=makeRun(root),stale=makeRun(root);finishRun(stale);atomicWrite(path.join(active.dir,'work'),Buffer.alloc(100));const saved=path.join(dir,'saved.html');atomicWrite(saved,'retained');fs.symlinkSync(saved,path.join(stale.dir,'link'));fs.symlinkSync(dir,path.join(root,'runs','outside'));
    const result=collect(root,{maxBytes:0});assert.ok(result.removed.includes(stale.dir));assert.ok(fs.existsSync(active.dir));assert.equal(fs.readFileSync(saved,'utf8'),'retained');assert.ok(fs.lstatSync(path.join(root,'runs','outside')).isSymbolicLink());
    const foreign=path.join(dir,'foreign');fs.mkdirSync(foreign);fs.writeFileSync(path.join(foreign,'keep'),'x');assert.throws(()=>cacheRoot({EXPLAINER_HTML_CACHE_DIR:foreign}),/not owned/);
    assert.throws(()=>cacheRoot({EXPLAINER_HTML_CACHE_DIR:path.join(root,'runs','outside')}),/symlink/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('bundle operates from a relocated portable package without node_modules',async()=>{
  const dir=temp();try{const copy=path.join(dir,'portable skill');fs.cpSync(ROOT,copy,{recursive:true,filter:p=>!p.includes('node_modules')&&!p.includes('test-results')});const out=await run(process.execPath,[path.join(copy,'scripts/render.mjs'),'render',path.join(copy,'examples/components.md'),'--json'],{env:{...process.env,EXPLAINER_HTML_CACHE_DIR:path.join(dir,'cache')}});assert.equal(JSON.parse(out.stdout).validation.structural,'passed');}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('concurrent invocations keep independent manifests and complete outputs',async()=>{
  const dir=temp();try{const root=cacheRoot({EXPLAINER_HTML_CACHE_DIR:path.join(dir,'cache')}),env={...process.env,EXPLAINER_HTML_CACHE_DIR:root};const outputs=await Promise.all([1,2,3].map(()=>run(process.execPath,[path.join(ROOT,'scripts/render.mjs'),'render',path.join(ROOT,'examples/components.md'),'--json'],{env})));assert.equal(new Set(outputs.map(o=>JSON.parse(o.stdout).html)).size,3);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
