import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { ROOT, run, hash } from '../src/util.mjs';
import { inspectHtml } from '../src/compile.mjs';
import { decodeWav, RATE } from '../src/tts.mjs';

const dir=process.env.EXPLAINER_HTML_MEDIA_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'explainer-html-media-'));fs.mkdirSync(dir,{recursive:true});
const env={...process.env,EXPLAINER_HTML_CACHE_DIR:path.join(dir,'cache')};
const cli=async(args,extra={})=>JSON.parse((await run(process.execPath,[path.join(ROOT,'scripts/render.mjs'),...args,'--json'],{env:{...env,...extra},timeout:120000})).stdout);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(id,predicate,timeout=180000){const deadline=Date.now()+timeout;let s;while(Date.now()<deadline){s=await cli(['status',id]);if(predicate(s))return s;if(['failed','cancelled','interrupted'].includes(s.status))throw new Error(JSON.stringify(s));await sleep(350);}throw new Error('Job test timed out: '+JSON.stringify(s));}
const report={systemVoices:[],providers:[],jobs:[],timing:[],dir};
const english='---\ntitle: A request and a response\nlang: en\nvideo: on\nvoice: system\n---\n## Request\n```architecture\nnodes: {client: {label: Client, kind: client}, api: {label: API}}\nedges: [{id: request, from: client, to: api, label: Request}]\n```\n```beats\n- {narration: The client sends a request to the API., focus: [api]}\n```\n';
fs.writeFileSync(path.join(dir,'english.md'),english);
const narrated=[];
for(const [lang,input]of [['th',path.join(ROOT,'examples/thai-video.md')],['en',path.join(dir,'english.md')]]){
  const result=await cli(['render',input,'--voice','system','--save',path.join(dir,`${lang}-narrated.html`)]),data=inspectHtml(fs.readFileSync(result.html,'utf8')).data;
  assert.equal(result.provider,'system');const buffer=Buffer.from(data.audio.split(',')[1],'base64'),samples=decodeWav(buffer);assert.ok(samples.some(v=>Math.abs(v)>100));assert.ok(Math.abs(samples.length/RATE-data.timeline.duration)<.001);fs.writeFileSync(path.join(dir,`${lang}-narration.wav`),buffer);report.systemVoices.push({lang,voice:lang==='th'?'Kanya':'Samantha',html:result.html,audio:path.join(dir,`${lang}-narration.wav`),duration:result.duration,samples:samples.length});narrated.push(result);
}
for(const [provider,configured]of [['elevenlabs',Boolean(env.ELEVENLABS_API_KEY)],['local',Boolean(env.EXPLAINER_HTML_TTS_URL)]]){
  if(configured){const result=await cli(['render',path.join(dir,'english.md'),'--voice',provider]);assert.equal(result.provider,provider);report.providers.push({provider,live:'passed'});}else report.providers.push({provider,live:'not-configured',contract:'covered by unit tests'});
}
const browser=await chromium.launch({executablePath:env.EXPLAINER_HTML_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{for(const result of narrated){const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.context().setOffline(true);await page.goto(pathToFileURL(result.html).href);await page.evaluate(()=>window.explainerHtml.ready);const duration=await page.evaluate(()=>window.explainerHtml.state().audioDuration);assert.ok(Math.abs(duration-result.duration)<.1);await page.locator('#play').click();await page.waitForTimeout(800);const drift=await page.evaluate(()=>{const s=window.explainerHtml.state();return Math.abs(s.time-s.audioTime);});assert.ok(drift<=.1,`Audio drift ${drift}`);await page.locator('#play').click();await page.evaluate(()=>window.explainerHtml.seek(1.5));const s=await page.evaluate(()=>window.explainerHtml.state());assert.ok(Math.abs(s.time-s.audioTime)<.1);await page.evaluate(()=>window.explainerHtml.setExport(true));await page.setViewportSize({width:1920,height:1080});await page.evaluate(()=>window.explainerHtml.renderAt(2));await page.screenshot({path:path.join(dir,result===narrated[0]?'thai-export-frame.png':'english-export-frame.png')});report.timing.push({html:result.html,driftSeconds:drift,measuredDuration:duration});await page.close();}}finally{await browser.close();}

// Exercise cancellation, process interruption and immutable frame reuse on one job.
const recoverySpec=english.replace('voice: system','voice: off').replace('focus: [api]','focus: [api], duration: 4');fs.writeFileSync(path.join(dir,'recovery.md'),recoverySpec);
const recovery=await cli(['render',path.join(dir,'recovery.md')]);let job=await cli(['export',recovery.html]);await until(job.id,s=>s.nextFrame>=16);await cli(['cancel',job.id]);await sleep(600);let cancelled=await cli(['status',job.id]);assert.equal(cancelled.status,'cancelled');const firstFrame=path.join(job.jobDir,'frames','00000000.png'),firstHash=hash(fs.readFileSync(firstFrame));
job=await cli(['resume',job.id]);await until(job.id,s=>s.nextFrame>=46);process.kill(-job.pid,'SIGKILL');await sleep(600);const interrupted=await cli(['status',job.id]);assert.equal(interrupted.status,'interrupted');assert.equal(hash(fs.readFileSync(firstFrame)),firstHash);
job=await cli(['resume',job.id]);
// A second export can fail independently while the resumed one remains active.
const bad=await cli(['export',narrated[1].html],{EXPLAINER_HTML_FFMPEG:'/usr/bin/false'});const failed=await until(bad.id,s=>s.status==='failed');assert.equal(failed.phase,'encode');assert.ok(fs.existsSync(narrated[1].html));
const recovered=await until(job.id,s=>s.status==='completed');assert.equal(hash(fs.readFileSync(firstFrame)),firstHash);report.jobs.push({id:job.id,status:recovered.status,cancellation:'passed',processInterruption:'passed',resume:'passed',frameHashPreserved:true});
await cli(['resume',bad.id]);const fixed=await until(bad.id,s=>s.status==='completed');report.jobs.push({id:bad.id,status:fixed.status,encoderFailure:'passed',resume:'passed',concurrentWith:job.id});
const timed=await cli(['export',recovery.html],{EXPLAINER_HTML_EXPORT_TIMEOUT:'0.001'});const timedOut=await until(timed.id,s=>s.status==='failed');assert.match(timedOut.error,/timed out/);report.jobs.push({id:timed.id,timeout:'passed',htmlPreserved:fs.existsSync(recovery.html)});
const thaiJob=await cli(['export',narrated[0].html,'--save',path.join(dir,'thai-explainer.mp4')]);const thai=await until(thaiJob.id,s=>s.status==='completed');
for(const job of [recovered,fixed,thai]){
  const probe=JSON.parse((await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',job.output])).stdout),video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio');assert.equal(video.width,1920);assert.equal(video.height,1080);assert.equal(video.codec_name,'h264');assert.equal(video.r_frame_rate,'30/1');assert.equal(audio.codec_name,'aac');assert.ok(Math.abs(Number(probe.format.duration)-job.duration)<.1);report.jobs.push({id:job.id,output:job.output,probe:{video:video.codec_name,audio:audio.codec_name,width:video.width,height:video.height,fps:video.r_frame_rate,duration:probe.format.duration}});
}
await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','5','-i',thai.output,'-frames:v','1',path.join(dir,'thai-mp4-frame.png')]);
await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',thai.output,'-vn','-acodec','pcm_s16le','-ar',String(RATE),path.join(dir,'thai-mp4-audio.wav')]);assert.ok(decodeWav(fs.readFileSync(path.join(dir,'thai-mp4-audio.wav'))).some(v=>Math.abs(v)>100));
report.thaiMp4=thai.output;fs.writeFileSync(path.join(dir,'media-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({dir,report:path.join(dir,'media-report.json'),thaiMp4:thai.output}));
