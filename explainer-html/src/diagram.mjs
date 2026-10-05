import fs from 'node:fs';
import path from 'node:path';
import { parse as parseHtml, serializeOuter } from 'parse5';
import { ROOT, run, fail, record, list, identifier, esc, choice } from './util.mjs';
import { entities } from './parse.mjs';

const TYPES = {service:'backend',client:'frontend',queue:'messagebus',decision:'security',store:'database'};
const legalTypes = ['frontend','backend','database','cloud','security','messagebus','external'];
const widthOf = text => [...new Intl.Segmenter('th',{granularity:'grapheme'}).segment(String(text))].reduce((n,{segment})=>n+(/[\u0e00-\u0e7f\u2e80-\uffff]/.test(segment)?12:9),0);
function normalizeNodes(map,ctx) {
  return entities(map,ctx).map(n=>{const type=TYPES[n.kind]||n.kind||'backend';choice(type,legalTypes,ctx);return {...n,type};});
}
function edgesOf(input,nodes,ctx) {
  const ids = new Set(nodes.map(n=>n.id));
  return list(input||[],ctx).map((e,i)=>{
    record(e,ctx); const id=identifier(e.id||`edge-${i+1}`,ctx);
    if(ids.has(id))fail(`Duplicate entity ID ${id}`,ctx);ids.add(id);
    if(!nodes.some(n=>n.id===e.from)||!nodes.some(n=>n.id===e.to))fail(`Unknown endpoint in ${id}`,ctx);
    if(e.label !== undefined && typeof e.label !== 'string') fail('Edge label must be text',ctx);
    return {...e,id};
  });
}

// Condense strongly connected components before ranking; retain every original edge.
export function ranks(ids,edges) {
  const adjacency = new Map(ids.map(id=>[id,[]]));
  edges.forEach(e=>{if(adjacency.has(e.from)&&adjacency.has(e.to)) adjacency.get(e.from).push(e.to);});
  let serial=0;const index=new Map(),low=new Map(),stack=[],on=new Set(),groups=[];
  function visit(v) {
    index.set(v,serial);low.set(v,serial++);stack.push(v);on.add(v);
    for(const w of adjacency.get(v)){if(!index.has(w)){visit(w);low.set(v,Math.min(low.get(v),low.get(w)));}else if(on.has(w))low.set(v,Math.min(low.get(v),index.get(w)));}
    if(low.get(v)===index.get(v)){const group=[];let w;do{w=stack.pop();on.delete(w);group.push(w);}while(w!==v);groups.push(group.sort((a,b)=>ids.indexOf(a)-ids.indexOf(b)));}
  }
  ids.forEach(id=>{if(!index.has(id))visit(id);});
  const groupOf=new Map(groups.flatMap((g,i)=>g.map(id=>[id,i]))), rank=new Map(groups.map((_,i)=>[i,0]));
  for(let i=0;i<groups.length;i++)for(const e of edges){const a=groupOf.get(e.from),b=groupOf.get(e.to);if(a!==b&&a!==undefined&&b!==undefined)rank.set(b,Math.max(rank.get(b),rank.get(a)+groups[a].length));}
  return new Map(groups.flatMap((g,i)=>g.map((id,n)=>[id,rank.get(i)+n])));
}

export function layoutGraph(nodes, edges, rawGroups, direction='LR', scale=1, ctx={}) {
  choice(direction,['LR','TB'],ctx);
  const groups=list(rawGroups||[],ctx).map(g=>{record(g,ctx);identifier(g.id,ctx);return {...g,label:String(g.label||g.id),members:list(g.members||[],ctx),children:[]};});
  const gmap=new Map(), owner=new Map(), byId=new Map(nodes.map(n=>[n.id,n]));
  for(const g of groups){if(gmap.has(g.id)||byId.has(g.id))fail(`Duplicate group ${g.id}`,ctx);gmap.set(g.id,g);}
  for(const g of groups){
    if(g.parent){if(!gmap.has(g.parent))fail(`Unknown parent group ${g.parent}`,ctx);gmap.get(g.parent).children.push(g.id);}
    for(const id of g.members){if(!byId.has(id))fail(`Group ${g.id} refers to unknown node ${id}`,ctx);if(owner.has(id))fail(`Node ${id} belongs to two groups; use parent for nesting`,ctx);owner.set(id,g.id);}
    const seen=new Set([g.id]);let p=g.parent;while(p){if(seen.has(p))fail('Group parent cycle',ctx);seen.add(p);p=gmap.get(p)?.parent;}
  }
  const boxes = new Map(), groupBoxes=new Map();
  function arrange(groupId) {
    const ownNodes=nodes.filter(n=>(owner.get(n.id)||null)===groupId);
    const children=groups.filter(g=>(g.parent||null)===groupId);
    const items=[...ownNodes.map(n=>({id:n.id,w:Math.max(180,widthOf(n.label)+60,widthOf(n.description||'')+50),h:n.description?88:72,leaves:[n.id]})),...children.map(g=>{const b=arrange(g.id);return{id:g.id,...b};})];
    if(!items.length)fail(`Empty group ${groupId}`,ctx);
    const map=new Map(items.flatMap(x=>x.leaves.map(id=>[id,x.id])));
    const related=edges.map(e=>({from:map.get(e.from),to:map.get(e.to)})).filter(e=>e.from&&e.to&&e.from!==e.to);
    const r=ranks(items.map(x=>x.id),related), layers=new Map();
    for(const item of items){const k=r.get(item.id);if(!layers.has(k))layers.set(k,[]);layers.get(k).push(item);}
    const gap=Math.max(180,...edges.map(e=>widthOf(e.label||'')+65))*scale;
    let along=0,acrossMax=0;const placements=[];
    for(const [,layer]of [...layers.entries()].sort((a,b)=>a[0]-b[0])) {
      let across=0;const maxAlong=Math.max(...layer.map(x=>direction==='LR'?x.w:x.h));
      for(const item of layer){const x=direction==='LR'?along:across,y=direction==='LR'?across:along;placements.push({...item,x,y});across+=(direction==='LR'?item.h:item.w)+100*scale;}
      acrossMax=Math.max(acrossMax,across-100*scale);along+=maxAlong+gap;
    }
    const pad=groupId?72:80;
    const dx=pad,dy=pad;
    for(const item of placements){
      if(byId.has(item.id))boxes.set(item.id,{x:item.x+dx,y:item.y+dy,width:item.w,height:item.h});
      else {
        for(const id of item.leaves){const b=boxes.get(id);b.x+=item.x+dx;b.y+=item.y+dy;}
        for(const [id,b] of groupBoxes){if(b.ancestors.includes(item.id)){b.x+=item.x+dx;b.y+=item.y+dy;}}
      }
    }
    const w=(direction==='LR'?along-gap:acrossMax)+pad*2,h=(direction==='LR'?acrossMax:along-gap)+pad*2;
    const leaves=items.flatMap(x=>x.leaves);
    if(groupId){const ancestors=[];let p=groupId;while(p){ancestors.push(p);p=gmap.get(p)?.parent;}groupBoxes.set(groupId,{x:0,y:0,width:w,height:h,ancestors,leaves});}
    return {w,h,leaves};
  }
  const dimensions=arrange(null);
  const bounds=groups.map(g=>{
    const leaves=groupBoxes.get(g.id).leaves;
    const childDepth=id=>{const ch=gmap.get(id).children;return ch.length?1+Math.max(...ch.map(childDepth)):0;};
    return {kind:g.parent?'security-group':'region',label:g.label,wraps:leaves,pad:30+childDepth(g.id)*28};
  });
  return {boxes,bounds,dimensions};
}

function walk(node,fn){fn(node);for(const child of node.childNodes||[])walk(child,fn);}
const attr=(n,key)=>n.attrs?.find(a=>a.name===key)?.value;
function set(n,key,value){n.attrs??=[];const found=n.attrs.find(a=>a.name===key);if(found)found.value=String(value);else n.attrs.push({name:key,value:String(value)});}
export function extractSvg(html,prefix,lang) {
  const doc=parseHtml(html);let svg;
  walk(doc,n=>{if(n.tagName==='svg'&&!svg)svg=n;});if(!svg)throw new Error('Archify returned no SVG');
  const ids=new Map();walk(svg,n=>{if(attr(n,'id'))ids.set(attr(n,'id'),`${prefix}-${attr(n,'id')}`);});
  walk(svg,n=>{
    for(const a of n.attrs||[]){
      if(a.name==='id')a.value=ids.get(a.value);
      else if(a.name==='href'&&a.value.startsWith('#'))a.value='#'+(ids.get(a.value.slice(1))||a.value.slice(1));
      else a.value=a.value.replace(/url\(#([^)]*)\)/g,(_,id)=>`url(#${ids.get(id)||id})`);
      if(['aria-labelledby','aria-describedby'].includes(a.name))a.value=a.value.split(' ').map(id=>ids.get(id)||id).join(' ');
    }
    if(attr(n,'data-node-id')) {set(n,'data-entity',attr(n,'data-node-id'));set(n,'aria-label',attr(n,'data-node-label'));}
    if(attr(n,'data-edge-id'))set(n,'data-entity',attr(n,'data-edge-id'));
    if(n.tagName==='path'&&attr(n,'data-composition-points')) {
      for(const [short,long]of [['from','from'],['to','to'],['id','id']])if(attr(n,`data-edge-${short}`))set(n,`data-composition-edge-${long}`,attr(n,`data-edge-${short}`));
    }
  });
  set(svg,'lang',lang);set(svg,'role','img');set(svg,'class','diagram-svg');
  const viewBox=attr(svg,'viewBox')?.split(/\s+/).map(Number)||[0,0,920,600];
  return {svg:serializeOuter(svg),width:viewBox[2],height:viewBox[3]};
}

// Use the pinned renderer's measured geometry, not label text parsed from errors.
// Its connection report keeps candidate order; validate that order before mapping
// positions back to stable edge IDs, including repeated labels/endpoints.
function repairLabelPositions(report,edges,pins) {
  if(report?.contract!=='archify-architecture-layout-v1'||report.connections?.length!==edges.length)return [];
  if(!edges.every((e,i)=>{const c=report.connections[i];return c.from===e.from&&c.to===e.to&&c.label===(e.label||null);}))return [];
  const boxes=report.components,labels=report.labels.map(l=>({...l})),used=new Set(),changed=[];
  const overlaps=(a,b,pad=6)=>a.x<b.x+b.width+pad&&a.x+a.width+pad>b.x&&a.y<b.y+b.height+pad&&a.y+a.height+pad>b.y;
  for(const [index,edge] of edges.entries()){
    const point=report.connections[index].labelAt;
    if(!point)continue;
    const at=labels.findIndex((l,i)=>!used.has(i)&&l.text===edge.label&&l.labelAt[0]===point[0]&&l.labelAt[1]===point[1]);
    if(at<0)continue;
    used.add(at);
    const label=labels[at],obstacles=[...boxes,...labels.filter((_,i)=>i!==at)];
    const blocked=obstacles.filter(b=>overlaps(label,b));
    if(!blocked.length)continue;
    const positions=blocked.flatMap(b=>[
      {x:label.x,y:b.y+b.height+12},
      {x:label.x,y:b.y-label.height-12},
      {x:b.x+b.width+12,y:label.y},
      {x:b.x-label.width-12,y:label.y},
    ]).map(p=>({...label,...p})).filter(p=>p.x>=0&&p.y>=0&&p.x+p.width<=report.viewBox[0]&&p.y+p.height<=report.viewBox[1]&&obstacles.every(b=>!overlaps(p,b)));
    positions.sort((a,b)=>(a.x-label.x)**2+(a.y-label.y)**2-((b.x-label.x)**2+(b.y-label.y)**2));
    if(!positions.length)continue;
    const next=positions[0],anchor=[point[0]+next.x-label.x,point[1]+next.y-label.y];
    pins.set(edge.id,anchor);labels[at]={...next,labelAt:anchor};changed.push(edge.id);
  }
  return changed;
}

export async function renderDiagram(block, {dir,prefix,lang,title}) {
  const ctx={line:block.line,component:block.kind};const v=record(block.value,ctx);
  const isSeq=block.kind==='sequence';
  const nodes=normalizeNodes(isSeq?v.participants:v.nodes,ctx),edges=edgesOf(isSeq?v.messages:v.edges,nodes,ctx);
  if(isSeq&&nodes.length<2)fail('A sequence needs two or more participants',ctx);
  const mode=isSeq?'sequence':'architecture';const reports=[],pins=new Map();let last,scale=1;
  for(let attempt=0;attempt<3;attempt++) {
    const meta={title,output:`${prefix}.html`,locale:'en',legend:{mode:'hidden'},animation:'none'};
    let candidate;
    if(isSeq) {
      const gap=Math.max(240,...edges.map(e=>widthOf(e.label||'')+120))*(1+attempt*0.35);
      const height=Math.max(480,260+edges.length*72);
      candidate={schema_version:1,diagram_type:mode,meta:{...meta,column_fit:'spread',viewBox:[Math.max(650,nodes.length*gap),height]},participants:nodes.map(n=>({id:n.id,type:n.type,label:n.label,...(n.description?{sublabel:String(n.description)}:{})})),messages:edges.map((e,i)=>({id:e.id,from:e.from,to:e.to,label:e.label||'',y:170+i*72,variant:e.kind==='response'?'return':e.kind==='async'?'dashed':'default',...(e.note?{note:String(e.note)}:{})}))};
    } else {
      const layout=layoutGraph(nodes,edges,v.groups,v.direction||'LR',scale,ctx);
      candidate={schema_version:1,diagram_type:mode,meta,components:nodes.map(n=>{const b=layout.boxes.get(n.id);return {id:n.id,type:n.type,label:n.label,pos:[b.x,b.y],size:[b.width,b.height],...(n.description?{sublabel:String(n.description)}:{})};}),boundaries:layout.bounds,connections:edges.map(e=>({id:e.id,from:e.from,to:e.to,...(e.label?{label:e.label}:{}),...(pins.has(e.id)?{labelAt:pins.get(e.id)}:{}),variant:e.kind==='async'?'dashed':e.kind==='response'?'default':'emphasis'}))};
    }
    const json=path.join(dir,`${prefix}.json`),out=path.join(dir,`${prefix}.html`);
    fs.writeFileSync(json,JSON.stringify(candidate));
    try {
      await run(process.execPath,[path.join(ROOT,'vendor/archify/renderers',mode,`render-${mode}.mjs`),json,out],{cwd:dir,env:{...process.env,ARCHIFY_UPDATE_CHECK_DISABLED:'1'},timeout:60000});
      const result=extractSvg(fs.readFileSync(out,'utf8'),prefix,lang);
      const label = lang==='th'?'แผนภาพ':'Diagram';
      return {html:`<figure class="diagram" data-diagram="${prefix}"><div class="diagram-tools"><button type="button" data-zoom="in" aria-label="${label} +">+</button><button type="button" data-zoom="out" aria-label="${label} −">−</button><button type="button" data-zoom="reset" aria-label="${label} 100%">↺</button><button type="button" data-zoom="fit">${lang==='th'?'ภาพรวม':'Fit'}</button></div><div class="diagram-scroll" tabindex="0" role="region" aria-label="${label}"><div class="diagram-canvas" style="--diagram-width:${result.width}px">${result.svg}</div></div><figcaption>${lang==='th'?'ลากเพื่อเลื่อน · + / − เพื่อซูม · ภาพรวมเพื่อดูทั้งหมด':'Drag to pan · + / − to zoom · Fit to see everything'}</figcaption></figure>`,ids:[...nodes.map(n=>n.id),...edges.map(e=>e.id)],report:{engine:'archify',version:'3.0.1',type:mode,nodes:nodes.length,edges:edges.length,attempts:attempt+1,checks:'schema + renderer geometry',repairs:reports}};
    } catch(e) {
      last=e;const repair={attempt:attempt+1,message:String(e.stderr||e.message).slice(0,1000)};
      if(!isSeq&&attempt<2){
        let changed=[];
        try{
          const measured=await run(process.execPath,[path.join(ROOT,'vendor/archify/renderers/architecture/render-architecture.mjs'),json,out,'--layout-json'],{cwd:dir,env:{...process.env,ARCHIFY_UPDATE_CHECK_DISABLED:'1'},timeout:60000}).catch(error=>error);
          changed=repairLabelPositions(JSON.parse(measured.stdout),edges,pins);
        }catch{/* Preserve the original failure if no measured repair is available. */}
        if(changed.length){repair.strategy='label-position';repair.edges=changed;}
        else {scale+=0.55;pins.clear();repair.strategy='spacing';}
      }
      reports.push(repair);
    }
  }
  fail(`Archify could not produce a valid layout: ${String(last.stderr||last.message).slice(0,1500)}`,{...ctx,code:'layout-failed',hint:'Keep all relationships; split independent topics into separate sections or simplify labels.'});
}
