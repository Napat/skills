import { Marked } from 'marked';
import { esc, fail, list, record, identifier, textValue } from './util.mjs';

const safeLink = url => /^(https?:|mailto:|#)/i.test(url) ? url : '#';
const marked = new Marked({gfm:true, renderer:{
  html({text}) {return esc(text);},
  link({href,tokens}) { return `<a href="${esc(safeLink(href))}" rel="noreferrer">${this.parser.parseInline(tokens)}</a>`; },
  image({text}) {return `<span class="image-alt">${esc(text)}</span>`;},
  code({text,lang}) {
    const lines = text.split('\n').map(line => `<span class="code-line${lang === 'diff' ? line.startsWith('+')?' added':line.startsWith('-')?' removed':'':''}">${esc(line)||' '}</span>`).join('');
    return `<div class="code-wrap"><div class="code-label">${esc(lang || 'code')}</div><pre><code>${lines}</code></pre></div>`;
  }
}});
marked.use({extensions:[{name:'status',level:'inline',start(source){return source.search(/\[(✓|✗|!)\]/);},tokenizer(source){const m=/^\[(✓|✗|!)\](?![\[(])/.exec(source);if(m)return {type:'status',raw:m[0],symbol:m[1]};},renderer(token){const s=token.symbol;return `<span class="status ${s==='✓'?'positive':s==='✗'?'negative':'warning'}">${s}</span>`;}}]});
export function markdown(source) {
  return marked.parse(source)
    .replace(/<table>/g,'<div class="table-wrap" tabindex="0" role="region" aria-label="Comparison"><table>')
    .replace(/<th>/g,'<th scope="col">').replace(/<\/table>/g,'</table></div>');
}
export function renderSimple(block, prefix) {
  const ctx = {line:block.line,component:block.kind}; let serial = 0; const ids = [];
  function entity(item) { const id = item.id || `${prefix}-${++serial}`; identifier(id,ctx); if(ids.includes(id)) fail(`Duplicate ID ${id}`,ctx); ids.push(id); return `data-entity="${esc(id)}"`; }
  if (block.kind === 'tree') {
    const roots = Array.isArray(block.value) ? block.value : [block.value];
    function walk(items,depth=0) {
      if (depth > 24) fail('Tree nesting exceeds 24 levels',ctx);
      return `<ul>${list(items,ctx).map(item=>{record(item,ctx);return `<li ${entity(item)}><span class="tree-label">${esc(textValue(item.label,ctx))}</span>${item.children?walk(item.children,depth+1):''}</li>`;}).join('')}</ul>`;
    }
    return {html:`<div class="tree">${walk(roots)}</div>`,ids};
  }
  if (block.kind === 'timeline') {
    return {html:`<ol class="timeline">${list(block.value,ctx).map(item=>{record(item,ctx);return `<li ${entity(item)}><span class="timeline-dot"></span><div><span class="eyebrow">${esc(item.date||'')}</span><h3>${esc(textValue(item.label,ctx))}</h3>${item.status?`<span class="tag">${esc(item.status)}</span>`:''}${item.detail?`<p>${esc(item.detail)}</p>`:''}</div></li>`;}).join('')}</ol>`,ids};
  }
  if (['annot','code-annot'].includes(block.kind)) {
    const value = record(block.value,ctx), source = textValue(value.text,ctx), ranges=[];
    const notes = list(value.notes||[],ctx).map((note,i)=> {
      record(note,ctx); const quote=textValue(note.quote,ctx); textValue(note.note,ctx);
      if(note.occurrence===undefined && source.indexOf(quote)!==source.lastIndexOf(quote)) fail('Repeated annotation quote needs occurrence',ctx);
      const occurrence=note.occurrence ?? 1;
      if (!Number.isInteger(occurrence)||occurrence<1) fail('occurrence must be a positive integer',ctx);
      let start=-1; for(let n=0;n<occurrence;n++){start=source.indexOf(quote,start+1);if(start<0)fail(`Annotation quote not found: ${quote}`,ctx);}
      const id=note.id||`${prefix}-note-${i+1}`; entity({id});
      ranges.push({start,end:start+quote.length,id,index:i}); return {...note,id};
    });
    ranges.sort((a,b)=>a.start-b.start); let last=0, out='';
    for(const r of ranges){if(r.start<last)fail('Annotation anchors overlap',ctx);out+=esc(source.slice(last,r.start))+`<button class="anchor" type="button" data-note="${prefix}-${r.index}" data-entity="${r.id}" aria-expanded="false" aria-controls="${prefix}-${r.index}">${esc(source.slice(r.start,r.end))}</button>`;last=r.end;}
    out+=esc(source.slice(last));
    const notesHtml=notes.map((n,i)=>`<aside hidden class="annotation-note" id="${prefix}-${i}"><b>${esc(n.quote)}</b><p>${esc(n.note)}</p></aside>`).join('');
    return {html:`<div class="annotation">${block.kind==='code-annot'?`<pre><code>${out}</code></pre>`:`<p>${out}</p>`}${notesHtml}</div>`,ids};
  }
  fail(`Unknown component ${block.kind}`,ctx);
}
