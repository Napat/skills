import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { hash, run, atomicWrite, ExplainError } from './util.mjs';
export const RATE=22050;
export function wav(samples,rate=RATE) {
  const out=Buffer.alloc(44+samples.length*2);out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(samples.length*2,40);
  for(let i=0;i<samples.length;i++)out.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(samples[i]))),44+i*2);return out;
}
export function decodeWav(buf) {
  if(buf.length<44||buf.toString('ascii',0,4)!=='RIFF'||buf.toString('ascii',8,12)!=='WAVE')throw new Error('Expected a PCM WAV clip');
  let pos=12,format,rate,channels,bits,data;
  while(pos+8<=buf.length){const id=buf.toString('ascii',pos,pos+4),size=buf.readUInt32LE(pos+4),start=pos+8;
    if(start+size>buf.length)throw new Error('Truncated WAV');
    if(id==='fmt '){if(size<16)throw new Error('Invalid WAV header');format=buf.readUInt16LE(start);channels=buf.readUInt16LE(start+2);rate=buf.readUInt32LE(start+4);bits=buf.readUInt16LE(start+14);}
    if(id==='data')data=buf.subarray(start,start+size);pos=start+size+(size%2);
  }
  if(format!==1||bits!==16||!channels||channels>8||rate<8000||rate>192000||!data?.length)throw new Error('Speech must be non-empty 16-bit PCM WAV');
  const count=Math.floor(data.length/(channels*2));const mono=new Int16Array(count);
  for(let i=0;i<count;i++){let v=0;for(let c=0;c<channels;c++)v+=data.readInt16LE((i*channels+c)*2);mono[i]=Math.round(v/channels);}
  if(rate===RATE)return mono;
  const out=new Int16Array(Math.round(count*RATE/rate));
  for(let i=0;i<out.length;i++){const x=i*rate/RATE,j=Math.floor(x),f=x-j;out[i]=Math.round((mono[j]||0)*(1-f)+(mono[Math.min(j+1,count-1)]||0)*f);}return out;
}
export function estimate(text,lang='en') {
  const words=[...new Intl.Segmenter(lang,{granularity:'word'}).segment(text)].filter(s=>s.isWordLike).length;
  return Math.max(1.8,words/(lang==='th'?2.9:2.6)+0.4);
}
export function timeline(sections,durations) {
  let time=0,index=0;
  const scenes=sections.map(s=>{
    const start=time;time+=0.6;
    const beats=s.beats.map(b=>{const duration=durations[index++],start=time;time+=duration+0.25;return {...b,start,end:start+duration};});
    time+=0.5;return {id:s.id,title:s.title,start,end:time,beats};
  });
  return {duration:time,fps:30,scenes};
}
export async function requestSpeech(url,body,{key,fetchImpl=fetch,timeout=60000,eleven=false}={}) {
  let res;
  try {res=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json',...(key?eleven?{'xi-api-key':key}:{Authorization:`Bearer ${key}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});}
  catch {throw new Error('Speech provider connection failed or timed out');}
  if(!res.ok)throw new Error(`Speech provider returned HTTP ${res.status}`);
  const buffer=Buffer.from(await res.arrayBuffer());
  if(buffer.length>64*1024*1024)throw new Error('Speech clip exceeds 64 MiB');return buffer;
}
async function systemProvider(lang) {
  if(process.platform!=='darwin')return null;
  try {
    const voices=(await run('/usr/bin/say',['-v','?'],{timeout:10000})).stdout.split('\n').map(l=>l.match(/^(.+?)\s+([a-z]{2}_[A-Z]{2})\s+#/)).filter(Boolean);
    const locale=lang==='th'?'th_TH':'en_US',preferred=lang==='th'?'Kanya':'Samantha';
    const voice=voices.find(v=>v[1].trim()===preferred&&v[2]===locale)?.[1].trim()||voices.find(v=>v[2]===locale)?.[1].trim();
    if(!voice)return null;
    return {name:'system',identity:`say:${voice}:${lang}`,async synth(text){
      const temp=fs.mkdtempSync(path.join(os.tmpdir(),'explainer-html-say-'));
      try {const input=path.join(temp,'text.txt'),out=path.join(temp,'speech.wav');fs.writeFileSync(input,text,{mode:0o600});await run('/usr/bin/say',['-v',voice,'-f',input,'-o',out,'--file-format=WAVE',`--data-format=LEI16@${RATE}`],{timeout:60000});return decodeWav(fs.readFileSync(out));}
      finally{fs.rmSync(temp,{recursive:true,force:true});}
    }};
  }catch{return null;}
}
async function elevenProvider(env,lang,fetchImpl) {
  if(!env.ELEVENLABS_API_KEY)return null;
  let response;
  try{response=await fetchImpl('https://api.elevenlabs.io/v1/models',{headers:{'xi-api-key':env.ELEVENLABS_API_KEY},signal:AbortSignal.timeout(10000)});}catch{throw new Error('Cannot inspect ElevenLabs language support');}
  if(!response.ok)throw new Error(`ElevenLabs model lookup returned HTTP ${response.status}`);
  const models=await response.json();
  const supported=models.filter(m=>m.can_do_text_to_speech&&m.languages?.some(l=>l.language_id===lang));
  const model=env.ELEVENLABS_MODEL_ID?supported.find(m=>m.model_id===env.ELEVENLABS_MODEL_ID):supported.find(m=>m.model_id==='eleven_multilingual_v2')||supported[0];
  if(!model)throw new Error(`No configured ElevenLabs model supports ${lang}`);
  const voice=env.ELEVENLABS_VOICE_ID||'JBFqnCBsd6RMkjVDRZzb';
  if(!/^[A-Za-z0-9_-]+$/.test(voice))throw new Error('Invalid ElevenLabs voice ID');
  return {name:'elevenlabs',identity:`elevenlabs:${model.model_id}:${voice}:${lang}`,async synth(text){
    const b=await requestSpeech(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=pcm_${RATE}`,{text,model_id:model.model_id},{key:env.ELEVENLABS_API_KEY,eleven:true,fetchImpl});
    if(!b.length||b.length%2)throw new Error('Invalid PCM speech');const out=new Int16Array(b.length/2);for(let i=0;i<out.length;i++)out[i]=b.readInt16LE(i*2);return out;
  }};
}
export function localProvider(env,lang,fetchImpl=fetch) {
  if(!env.EXPLAINER_HTML_TTS_URL)return null;
  const base=new URL(env.EXPLAINER_HTML_TTS_URL);if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw new Error('TTS URL must use HTTP(S) without embedded credentials');
  const url=base.href.replace(/\/$/,'')+'/v1/audio/speech';
  const options={...(env.EXPLAINER_HTML_TTS_MODEL?{model:env.EXPLAINER_HTML_TTS_MODEL}:{}),...(env.EXPLAINER_HTML_TTS_VOICE?{voice:env.EXPLAINER_HTML_TTS_VOICE}:{}),response_format:'wav',stream:false};
  return {name:'local',identity:`local:${url}:${JSON.stringify(options)}:${lang}`,async synth(input){return decodeWav(await requestSpeech(url,{...options,input},{key:env.EXPLAINER_HTML_TTS_API_KEY,fetchImpl,timeout:60000}));}};
}
export async function narration(doc,root,{env=process.env,fetchImpl=fetch,providers}={}) {
  const beats=doc.sections.flatMap(s=>s.beats),warnings=[];
  const fallback=()=>({provider:'captions',warnings,timeline:timeline(doc.sections,beats.map(b=>b.duration||estimate(b.narration,doc.meta.lang))),audio:null});
  if(!doc.meta.video||doc.meta.voice==='off')return fallback();
  const factories=providers||{elevenlabs:()=>elevenProvider(env,doc.meta.lang,fetchImpl),local:()=>localProvider(env,doc.meta.lang,fetchImpl),system:()=>systemProvider(doc.meta.lang)};
  const choices=doc.meta.voice==='auto'?['elevenlabs','local','system']:[doc.meta.voice];
  for(const choice of choices)try{
    const provider=await factories[choice]?.();if(!provider){if(doc.meta.voice!=='auto')throw new Error(`Provider ${choice} is unavailable`);continue;}
    const clips=[];
    for(const beat of beats){
      const key=hash(`${provider.identity}\0${beat.narration}`),file=path.join(root,'audio',`${key}.wav`);let samples;
      if(fs.existsSync(file)&&fs.lstatSync(file).isFile()){try{samples=decodeWav(fs.readFileSync(file));fs.utimesSync(file,new Date(),new Date());}catch{}}
      if(!samples){samples=await provider.synth(beat.narration);if(!samples?.length)throw new Error('Speech provider returned an empty clip');atomicWrite(file,wav(samples));}
      clips.push(samples);
    }
    const timings=timeline(doc.sections,clips.map(s=>s.length/RATE)),track=new Int16Array(Math.ceil(timings.duration*RATE));
    timings.scenes.flatMap(s=>s.beats).forEach((b,i)=>track.set(clips[i],Math.round(b.start*RATE)));
    return {provider:choice,warnings,timeline:timings,audio:wav(track)};
  }catch(e){
    if(doc.meta.voice!=='auto')throw new ExplainError(`${choice}: ${e.message}`,{component:'tts',code:'tts-failed',hint:'Fix provider configuration or select --voice off for captions.'});
    warnings.push(`${choice} unavailable: ${e.message}; using the next provider.`);
  }
  warnings.push('No speech provider is available; captions only.');return fallback();
}
