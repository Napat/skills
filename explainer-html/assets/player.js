(() => {
  'use strict';
  const data=JSON.parse(document.getElementById('explainer-data').textContent);
  const root=document.documentElement,body=document.body,th=data.meta.lang==='th';
  const $=s=>document.querySelector(s),all=(s,n=document)=>[...n.querySelectorAll(s)];
  const manualViews=new Map();
  const mediaDark=matchMedia('(prefers-color-scheme: dark)'),motion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mode=$('#mode'),theme=$('#theme');
  function color(){root.dataset.color=mode.value==='auto'?(mediaDark.matches?'dark':'light'):mode.value;root.dataset.mode=mode.value;}
  color();mode.addEventListener('change',color);mediaDark.addEventListener('change',color);theme.addEventListener('change',()=>root.dataset.theme=theme.value);
  $('#source-text').textContent=data.source;$('#source').onclick=()=>$('#source-dialog').showModal();$('#close-source').onclick=()=>$('#source-dialog').close();
  all('[data-note]').forEach(b=>b.addEventListener('click',()=>{const n=document.getElementById(b.dataset.note);n.hidden=!n.hidden;b.setAttribute('aria-expanded',String(!n.hidden));}));
  all('[data-node-id]').forEach(n=>{const activate=()=>{const on=n.getAttribute('aria-pressed')!=='true';n.setAttribute('aria-pressed',String(on));};n.addEventListener('click',activate);n.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();activate();}});});
  all('.diagram').forEach(figure=>{
    const canvas=figure.querySelector('.diagram-canvas'),scroll=figure.querySelector('.diagram-scroll'),svg=figure.querySelector('svg');let zoom=1,drag;
    const watching=()=>body.classList.contains('playing-view');
    const currentView=()=>{const b=svg.viewBox.baseVal;return [b.x,b.y,b.width,b.height];};
    const moveView=view=>{manualViews.set(svg,view);svg.setAttribute('viewBox',view.join(' '));};
    function scale(z){const next=Math.min(4,Math.max(.25,z));if(watching()){const b=currentView(),factor=next/zoom,w=b[2]/factor,h=b[3]/factor;moveView([b[0]+(b[2]-w)/2,b[1]+(b[3]-h)/2,w,h]);}else canvas.style.width=`max(100%, calc(var(--diagram-width) * ${next*1.5}))`;zoom=next;}
    all('[data-zoom]',figure).forEach(b=>b.onclick=()=>{if(watching()&&['reset','fit'].includes(b.dataset.zoom)){if(b.dataset.zoom==='fit')manualViews.set(svg,[...world]);else manualViews.delete(svg);zoom=1;renderAt(time);return;}if(b.dataset.zoom==='fit'){canvas.style.width='100%';zoom=scroll.clientWidth/(parseFloat(canvas.style.getPropertyValue('--diagram-width'))*1.5);return;}scale(b.dataset.zoom==='reset'?1:zoom*(b.dataset.zoom==='in'?1.25:.8));});
    scroll.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='='){scale(zoom*1.25);e.preventDefault();}if(e.key==='-'){scale(zoom*.8);e.preventDefault();}if(e.key==='0'){if(watching()){manualViews.delete(svg);renderAt(time);}else scale(1);}if(watching()&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){const b=currentView(),step=b[2]*.06;moveView([b[0]+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),b[1]+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0),b[2],b[3]]);e.preventDefault();}});
    scroll.addEventListener('pointerdown',e=>{if((e.pointerType!=='mouse'&&!watching())||e.button!==0||e.target.closest('[data-node-id]'))return;drag={x:e.clientX,y:e.clientY,left:scroll.scrollLeft,top:scroll.scrollTop,view:watching()?currentView():null};scroll.setPointerCapture(e.pointerId);scroll.classList.add('dragging');});
    scroll.addEventListener('pointermove',e=>{if(drag){if(drag.view){const b=drag.view;moveView([b[0]+(drag.x-e.clientX)*b[2]/scroll.clientWidth,b[1]+(drag.y-e.clientY)*b[3]/scroll.clientHeight,b[2],b[3]]);}else{scroll.scrollLeft=drag.left+drag.x-e.clientX;scroll.scrollTop=drag.top+drag.y-e.clientY;}}});
    const release=()=>{drag=null;scroll.classList.remove('dragging');};scroll.addEventListener('pointerup',release);scroll.addEventListener('pointercancel',release);
  });
  const timeline=data.timeline,scenes=timeline.scenes.map(s=>({...s,element:document.getElementById(s.id)}));
  let time=0,playing=false,reading=!data.meta.video,exporting=false,lastClock=0,clockOffset=0,raf;
  const audio=data.audio?new Audio(data.audio):null;if(audio){audio.preload='auto';audio.addEventListener('ended',()=>pause());audio.addEventListener('error',()=>{pause();$('#player-status').textContent=th?'เปิดเสียงไม่ได้ ใช้คำบรรยายแทน':'Audio unavailable; captions remain available';});}
  const easing=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const box=n=>{try{const b=n.getBBox();return {x:b.x,y:b.y,width:b.width,height:b.height};}catch{return null;}};
  const originals=new Map(),geometry=new Map();
  for(const s of scenes){
    const map=new Map();all('[data-entity]',s.element).forEach(n=>{const b=box(n);if(b&&n.matches('[data-node-id]'))map.set(n.dataset.entity,b);originals.set(n,{transform:n.getAttribute('transform'),opacity:n.style.opacity});});
    for(const p of all('path[data-composition-points]',s.element)){let points=[];try{const length=p.getTotalLength();points=Array.from({length:41},(_,i)=>{const pnt=p.getPointAtLength(length*i/40);return [pnt.x,pnt.y];});}catch{}originals.set(p,{d:p.getAttribute('d'),points,from:p.dataset.compositionEdgeFrom,to:p.dataset.compositionEdgeTo,id:p.dataset.compositionEdgeId||p.closest('[data-edge-id]')?.dataset.edgeId});}
    geometry.set(s.id,map);
  }
  const svgBoxes=all('.diagram-svg').map(n=>n.viewBox.baseVal),world=[0,0,Math.max(640,...svgBoxes.map(b=>b.width)),Math.max(300,...svgBoxes.map(b=>b.height))];
  const originalViews=new Map(all('.diagram-svg').map(n=>[n,n.getAttribute('viewBox')]));
  function camera(s,focus){
    const boxes=(focus||[]).map(id=>geometry.get(s.id).get(id)).filter(Boolean);if(!boxes.length)return world;
    const minX=Math.min(...boxes.map(b=>b.x))-75,minY=Math.min(...boxes.map(b=>b.y))-65;
    let w=Math.max(world[2]*.55,Math.max(...boxes.map(b=>b.x+b.width))-minX+75),h=Math.max(world[3]*.55,Math.max(...boxes.map(b=>b.y+b.height))-minY+65);
    if(w/h<world[2]/world[3])w=h*world[2]/world[3];else h=w*world[3]/world[2];
    return [minX-(w-(Math.max(...boxes.map(b=>b.x+b.width))-minX+75))/2,minY-(h-(Math.max(...boxes.map(b=>b.y+b.height))-minY+65))/2,w,h];
  }
  const lerp=(a,b,p)=>a+(b-a)*p;
  function morph(s,prev,p){
    const current=geometry.get(s.id),old=prev?geometry.get(prev.id):new Map(),deltas=new Map();
    all('[data-node-id]',s.element).forEach(n=>{
      const a=old.get(n.dataset.entity),b=current.get(n.dataset.entity),o=originals.get(n);if(!b)return;
      if(!a||p>=1){if(o.transform)n.setAttribute('transform',o.transform);else n.removeAttribute('transform');return;}
      const sx=lerp(a.width/b.width,1,p),sy=lerp(a.height/b.height,1,p),dx=lerp(a.x-b.x,0,p),dy=lerp(a.y-b.y,0,p);
      n.setAttribute('transform',`translate(${b.x+dx} ${b.y+dy}) scale(${sx} ${sy}) translate(${-b.x} ${-b.y}) ${o.transform||''}`);deltas.set(n.dataset.entity,[dx+(sx-1)*b.width/2,dy+(sy-1)*b.height/2]);
    });
    const previousPaths=new Map(prev?all('path[data-composition-points]',prev.element).map(n=>[originals.get(n).id,originals.get(n)]):[]);
    all('path[data-composition-points]',s.element).forEach(n=>{
      const b=originals.get(n),a=previousPaths.get(b.id),underlay=n.parentElement.querySelector('[data-graph-role="automatic-crossover-underlay"]');
      if(p>=1||!b.points.length){n.setAttribute('d',b.d);underlay?.setAttribute('d',b.d);return;}
      const same=a&&a.from===b.from&&a.to===b.to&&a.points.length===b.points.length;
      const from=deltas.get(b.from)||[0,0],to=deltas.get(b.to)||[0,0];
      const points=b.points.map((pt,i)=>{const f=i/(b.points.length-1);return same?pt.map((v,k)=>lerp(a.points[i][k],v,p)):pt.map((v,k)=>v+lerp(from[k],to[k],f));});
      n.setAttribute('d',points.map((pt,i)=>`${i?'L':'M'} ${pt[0]} ${pt[1]}`).join(' '));
      underlay?.setAttribute('d',n.getAttribute('d'));
    });
    // Labels follow their relationship midpoint while the route changes shape.
    all('[data-edge-id]',s.element).filter(n=>n.tagName.toLowerCase()==='g').forEach(n=>{
      const pth=n.querySelector('path[data-composition-points]'),from=pth?.dataset.compositionEdgeFrom||n.dataset.edgeFrom,to=pth?.dataset.compositionEdgeTo||n.dataset.edgeTo;
      const a=deltas.get(from)||[0,0],b=deltas.get(to)||[0,0];
      const labels=pth?[...n.children].filter(c=>c.tagName.toLowerCase()!=='path'&&c.tagName.toLowerCase()!=='title'):[n];
      labels.forEach(l=>{if(p<1)l.setAttribute('transform',`translate(${(a[0]+b[0])/2} ${(a[1]+b[1])/2})`);else {const o=originals.get(l);if(o?.transform)l.setAttribute('transform',o.transform);else l.removeAttribute('transform');}});
    });
  }
  function renderAt(value){
    time=Math.max(0,Math.min(timeline.duration,Number(value)||0));
    const idx=Math.max(0,scenes.findIndex(s=>time<s.end)),s=time===timeline.duration?scenes.at(-1):scenes[idx],index=scenes.indexOf(s),prev=scenes[index-1];
    if(!s)return;
    all('[data-chapter]').forEach(a=>{if(a.dataset.chapter===s.id)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current');});
    for(const scene of scenes){scene.element.classList.toggle('is-current',scene===s);scene.element.inert=!reading&&scene!==s;}
    let beat=null,previousBeat=null;const states={},hidden=new Set(s.beats.flatMap(b=>b.reveal||[]));
    for(const b of s.beats){if(time>=b.start){previousBeat=beat;beat=b;for(const id of b.reveal||[])hidden.delete(id);for(const id of b.hide||[])hidden.add(id);Object.assign(states,b.state||{});}else break;}
    all('[data-entity]',s.element).forEach(n=>{n.style.opacity=reading?'':hidden.has(n.dataset.entity)?'0.08':'1';if(!reading&&states[n.dataset.entity])n.dataset.state=states[n.dataset.entity];else delete n.dataset.state;});
    const p=(motion()&&!exporting)||time-s.start>=.599999?1:easing((time-s.start)/.6);
    if(!reading){morph(s,prev,p);let to=camera(s,beat?.focus),from=previousBeat?camera(s,previousBeat.focus):prev?camera(prev,prev.beats.at(-1)?.focus):world;
      const progress=motion()&&!exporting?1:easing((time-(beat?.start??s.start))/.5);
      const view=to.map((v,i)=>lerp(from[i],v,progress));all('.diagram-svg',s.element).forEach(svg=>svg.setAttribute('viewBox',(manualViews.get(svg)||view).join(' ')));
    }
    if(data.meta.video){$('#seek').value=String(time);$('#time').textContent=`${Math.floor(time/60)}:${String(Math.floor(time%60)).padStart(2,'0')} / ${Math.floor(timeline.duration/60)}:${String(Math.floor(timeline.duration%60)).padStart(2,'0')}`;$('#caption').textContent=beat?.narration||s.title;}
    return {time,scene:s.id,beat:beat?.id||null,transition:p};
  }
  function frame(now){if(!playing)return;renderAt(audio&&!audio.error?audio.currentTime:clockOffset+(now-lastClock)/1000);if(time>=timeline.duration){pause();return;}raf=requestAnimationFrame(frame);}
  function pause(){playing=false;audio?.pause();cancelAnimationFrame(raf);if(data.meta.video){$('#play').textContent='▶';$('#play').setAttribute('aria-label',th?'เล่น':'Play');}}
  async function play(){if(!data.meta.video)return;if(time>=timeline.duration)seek(0);setReading(false);playing=true;lastClock=performance.now();clockOffset=time;
    if(audio&&!audio.error){audio.currentTime=time;try{await audio.play();}catch{pause();$('#player-status').textContent=th?'กดเล่นอีกครั้งเพื่อเปิดเสียง':'Press play again to enable audio';return;}}
    $('#play').textContent='Ⅱ';$('#play').setAttribute('aria-label',th?'หยุดชั่วคราว':'Pause');cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);
  }
  function seek(t){renderAt(t);if(audio&&!audio.error)audio.currentTime=time;lastClock=performance.now();clockOffset=time;}
  function setReading(value){reading=value;body.classList.toggle('playing-view',!reading&&data.meta.video);if(value){pause();for(const [svg,v]of originalViews)svg.setAttribute('viewBox',v);for(const s of scenes){morph(s,null,1);all('[data-entity]',s.element).forEach(n=>{n.style.opacity='';delete n.dataset.state;});s.element.inert=false;}}if($('#view-toggle'))$('#view-toggle').textContent=reading?(th?'ดูทีละบท':'Watch step by step'):(th?'อ่านทุกบท':'Read all chapters');renderAt(time);}
  if(data.meta.video){setReading(false);$('#play').onclick=()=>playing?pause():play();$('#seek').oninput=()=>seek(Number($('#seek').value));$('#view-toggle').onclick=()=>setReading(!reading);
    function jump(delta){const i=scenes.findIndex(s=>s.id===renderAt(time).scene);seek(scenes[Math.min(scenes.length-1,Math.max(0,i+delta))].start);}
    $('#previous').onclick=()=>jump(-1);$('#next').onclick=()=>jump(1);
    all('[data-seek]').forEach(b=>b.onclick=()=>{setReading(false);seek(Number(b.dataset.seek));});
    all('[data-chapter]').forEach(a=>a.addEventListener('click',e=>{if(!reading){e.preventDefault();seek(scenes.find(s=>s.id===a.dataset.chapter).start);}}));
    document.addEventListener('keydown',e=>{if(e.defaultPrevented||e.target.closest('button,a,select,input,textarea,dialog')||reading)return;if(e.key===' '){e.preventDefault();playing?pause():play();}if(e.key==='ArrowRight'){e.preventDefault();seek(time+5);}if(e.key==='ArrowLeft'){e.preventDefault();seek(time-5);}});
  }
  const ready=Promise.all([document.fonts.ready,audio?new Promise(resolve=>{if(audio.readyState>=1)resolve();else{audio.addEventListener('loadedmetadata',resolve,{once:true});audio.addEventListener('error',resolve,{once:true});}}):Promise.resolve()]);
  window.explainerHtml={data,ready,renderAt,play,pause,seek,setReading,setExport(value){pause();exporting=Boolean(value);body.classList.toggle('exporting',exporting);if(exporting){manualViews.clear();mode.value=root.dataset.color;color();setReading(false);}renderAt(time);},state(){return {...renderAt(time),playing,reading,audioTime:audio?.currentTime??null,audioDuration:audio?.duration??null,provider:data.provider};}};
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>renderAt(time));
  renderAt(0);
})();
