import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse as parseHtml } from 'parse5';
import { ROOT, VERSION, esc, jsonText, fail, hash } from './util.mjs';
import { parse } from './parse.mjs';
import { markdown, renderSimple } from './components.mjs';
import { renderDiagram } from './diagram.mjs';

const attr=(n,key)=>n.attrs?.find(a=>a.name===key)?.value;
function walk(n,fn){fn(n);for(const child of n.childNodes||[])walk(child,fn);}
export function inspectHtml(html,{trustedRuntime=true}={}) {
  const ids=new Set(),refs=[],errors=[],doc=parseHtml(html);let data,runtime,style;
  walk(doc,n=>{
    const id=attr(n,'id');if(id){if(ids.has(id))errors.push(`Duplicate DOM ID ${id}`);ids.add(id);}
    for(const a of n.attrs||[]){
      if(a.name.startsWith('on'))errors.push('Inline event attributes are forbidden');
      for(const match of a.value.matchAll(/url\(#([^)]*)\)/g))refs.push(match[1]);
      if(['aria-labelledby','aria-describedby','aria-controls'].includes(a.name))refs.push(...a.value.split(/\s+/));
      if(a.name==='href'&&a.value.startsWith('#')&&a.value.length>1)refs.push(a.value.slice(1));
      if(['src','poster'].includes(a.name)&&!a.value.startsWith('data:'))errors.push(`External resource ${n.tagName}`);
    }
    if(['iframe','object','embed','base','link'].includes(n.tagName))errors.push(`Forbidden element ${n.tagName}`);
    const content=(n.childNodes||[]).map(c=>c.value||'').join('');
    if(n.tagName==='script') {
      if(id==='explainer-data'&&attr(n,'type')==='application/json'){try{data=JSON.parse(content);}catch{errors.push('Invalid embedded data');}}
      else if(id==='explainer-runtime'&&!attr(n,'src'))runtime=content;
      else errors.push('Unexpected script');
    }
    if(n.tagName==='style'){if(style!==undefined)errors.push('Unexpected stylesheet');style=content;if(/@import|url\(\s*['"]?(?:https?:|\/\/)/i.test(content))errors.push('External CSS resource');}
  });
  for(const id of refs)if(!ids.has(id))errors.push(`Unresolved DOM reference ${id}`);
  if(data?.generator!==`explainer-html/${VERSION}`)errors.push('Missing or unsupported generator');
  if(!runtime)errors.push('Missing runtime');
  if(trustedRuntime&&runtime!==fs.readFileSync(path.join(ROOT,'assets/player.js'),'utf8'))errors.push('Runtime does not match this package');
  if(trustedRuntime&&style!==fs.readFileSync(path.join(ROOT,'assets/style.css'),'utf8'))errors.push('Stylesheet does not match this package');
  if(errors.length)fail(errors.slice(0,12).join('; '),{component:'html',code:'invalid-html'});
  return {data,ids:ids.size,checks:['unique DOM IDs','resolved SVG/ARIA references','inline resources','known runtime']};
}

export async function prepare(source,{dir,overrides={}}) {
  const doc=parse(source,overrides),reports=[];
  async function blocks(items,sceneId){
    const ids=new Set();let html='';
    for(const [i,b]of items.entries()){
      if(b.kind==='markdown'){html+=markdown(b.text);continue;}
      const prefix=`${sceneId}-c${i+1}`;
      const result=['architecture','flow','sequence'].includes(b.kind)?await renderDiagram(b,{dir,prefix,lang:doc.meta.lang,title:doc.sections.find(s=>s.id===sceneId)?.title||doc.meta.title}):renderSimple(b,prefix);
      for(const id of result.ids){if(ids.has(id))fail(`Repeated entity ID ${id} within ${sceneId}`,{line:b.line,component:b.kind});ids.add(id);}
      html+=result.html;if(result.report)reports.push({...result.report,scene:sceneId});
    }
    return {html,ids};
  }
  const intro=await blocks(doc.intro,'intro');
  for(const s of doc.sections){
    const rendered=await blocks(s.blocks,s.id);s.html=rendered.html;
    for(const b of s.beats){
      const targets=[...(b.focus||[]),...(b.reveal||[]),...(b.hide||[]),...Object.keys(b.state||{})];
      for(const id of targets)if(!rendered.ids.has(id))fail(`Beat refers to missing ID ${id} in ${s.title}`,{line:b.line,component:'beats'});
      for(const value of Object.values(b.state||{}))if(!['active','done','warning','error','idle'].includes(value))fail(`Invalid state ${value}`,{line:b.line,component:'beats'});
    }
  }
  return {doc,intro:intro.html,reports};
}

export function compose(prepared,media,{warnings=[]}={}) {
  const {doc,intro,reports}=prepared,{meta}=doc,th=meta.lang==='th';
  const css=fs.readFileSync(path.join(ROOT,'assets/style.css'),'utf8'),js=fs.readFileSync(path.join(ROOT,'assets/player.js'),'utf8');
  const scriptHash=createHash('sha256').update(js).digest('base64');
  const licenses={explainerHtml:fs.readFileSync(path.join(ROOT,'LICENSE'),'utf8'),archify:fs.readFileSync(path.join(ROOT,'vendor/archify/LICENSE'),'utf8')};
  const data={generator:`explainer-html/${VERSION}`,source:doc.source,sourceHash:hash(doc.source),meta,timeline:media.timeline,provider:media.provider,audio:media.audio?`data:audio/wav;base64,${media.audio.toString('base64')}`:null,warnings:[...warnings,...media.warnings],diagrams:reports,licenses};
  const beats=media.timeline.scenes.flatMap(s=>s.beats);
  const html=`<!doctype html>
<html lang="${meta.lang}" data-theme="${meta.theme}" data-mode="${meta.mode}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; img-src data:; media-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>${esc(meta.title)}</title><style>${css}</style></head>
<body${meta.video?' class="has-video"':''}><a class="skip" href="#main">${th?'ข้ามไปเนื้อหา':'Skip to content'}</a><header class="topbar"><a class="brand" href="#main"><span class="brand-icon" aria-hidden="true">◈</span> EXPLAINER HTML</a><div class="preferences"><label><span class="sr-only">${th?'รูปแบบ':'Theme'}</span><select id="theme" aria-label="${th?'รูปแบบ':'Theme'}"><option value="shadcn"${meta.theme==='shadcn'?' selected':''}>shadcn</option><option value="blueprint"${meta.theme==='blueprint'?' selected':''}>Blueprint</option></select></label><label><span class="sr-only">${th?'โหมดสี':'Color mode'}</span><select id="mode" aria-label="${th?'โหมดสี':'Color mode'}">${['auto','light','dark'].map(m=>`<option value="${m}"${m===meta.mode?' selected':''}>${{auto:th?'อัตโนมัติ':'Auto',light:th?'สว่าง':'Light',dark:th?'มืด':'Dark'}[m]}</option>`).join('')}</select></label><button id="source" type="button">${th?'ต้นฉบับ':'Source'}</button></div></header>
<main id="main"><div class="hero"><div class="eyebrow">${meta.video?(th?'เรียนรู้ทีละขั้น':'A guided explanation'):(th?'มองให้เห็นภาพ':'Ideas, made visible')}</div><h1>${esc(meta.title)}</h1>${meta.subtitle?`<p class="subtitle">${esc(meta.subtitle)}</p>`:''}<div class="hero-meta"><span>${th?'เปิดได้ออฟไลน์':'Available offline'}</span><span>${String(doc.sections.length).padStart(2,'0')} ${th?'บท':'chapters'}</span>${meta.video?`<span>${media.provider==='captions'?(th?'คำบรรยาย':'Captions'):(th?'พร้อมเสียงบรรยาย':'Narrated')}</span>`:''}</div>${intro?`<div class="intro prose">${intro}</div>`:''}</div>
${data.warnings.length?`<details class="notices"><summary>${th?'ข้อมูลการสร้าง':'Build notes'} (${data.warnings.length})</summary><ul>${data.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></details>`:''}
<div class="workspace"><nav class="chapters" aria-label="${th?'บทเรียน':'Chapters'}"><div class="eyebrow">${th?'เนื้อหา':'Contents'}</div>${doc.sections.map((s,i)=>`<a href="#${s.id}" data-chapter="${s.id}"><span>${String(i+1).padStart(2,'0')}</span>${esc(s.title)}</a>`).join('')}${meta.video?`<button type="button" id="view-toggle">${th?'อ่านทุกบท':'Read all chapters'}</button>`:''}</nav><div class="content">
${meta.video?`<div class="player" role="region" aria-label="${th?'เครื่องเล่นคำอธิบาย':'Explainer player'}"><div class="playbar"><button type="button" id="play" aria-label="${th?'เล่น':'Play'}">▶</button><button type="button" id="previous" aria-label="${th?'บทก่อนหน้า':'Previous chapter'}">‹</button><button type="button" id="next" aria-label="${th?'บทถัดไป':'Next chapter'}">›</button><label for="seek" class="sr-only">${th?'ตำแหน่งเวลา':'Playback position'}</label><input id="seek" type="range" min="0" max="${media.timeline.duration}" step="0.01" value="0"><output id="time">0:00</output></div><p id="caption" class="caption" aria-live="off"></p><p id="player-status" class="sr-only" role="status"></p></div>`:''}
<div id="stage">${doc.sections.map((s,i)=>`<section class="scene prose" id="${s.id}" data-scene="${s.id}" aria-labelledby="${s.id}-title"><header class="scene-heading"><span class="scene-number">${String(i+1).padStart(2,'0')}</span><h2 id="${s.id}-title">${esc(s.title)}</h2></header>${s.html}</section>`).join('')}</div>
${meta.video?`<details class="transcript"><summary>${th?'คำบรรยายทั้งหมด':'Transcript'}</summary><ol>${beats.map(b=>`<li><button type="button" data-seek="${b.start}">${esc(b.narration)}</button></li>`).join('')}</ol></details>`:''}</div></div></main><footer>Explainer HTML <span aria-hidden="true">·</span> Archify 3.0.1 <span aria-hidden="true">·</span> ${th?'เนื้อหาและภาพอยู่ในไฟล์นี้':'Everything you need is in this file'}</footer>
<dialog id="source-dialog" aria-labelledby="source-title"><h2 id="source-title">${th?'ต้นฉบับที่แก้ไขได้':'Editable source'}</h2><button type="button" id="close-source">${th?'ปิด':'Close'}</button><pre id="source-text"></pre></dialog><script id="explainer-data" type="application/json">${jsonText(data)}</script><script id="explainer-runtime">${js}</script></body></html>`;
  const validation=inspectHtml(html);
  return {html,data,validation:{structural:'passed',checks:validation.checks,diagrams:reports,browser:'not-run',visual:'not-run'}};
}
