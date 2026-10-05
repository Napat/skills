import { parseDocument } from 'yaml';
import { lexer } from 'marked';
import { ExplainError, fail, record, list, identifier, textValue, choice } from './util.mjs';

const COMPONENTS = new Set(['architecture','flow','sequence','tree','timeline','annot','code-annot','beats']);
export function yaml(text, ctx) {
  const doc = parseDocument(text, {uniqueKeys:true, customTags:[], prettyErrors:false});
  if (doc.errors.length) fail(doc.errors[0].message, {...ctx, line:ctx.line + (doc.errors[0].linePos?.[0]?.line || 1) - 1});
  try { return doc.toJS({maxAliasCount:0}); } catch { fail('YAML aliases are not supported',ctx); }
}
export function parse(source, overrides = {}) {
  source = String(source).replace(/\r\n?/g,'\n');
  if (Buffer.byteLength(source) > 2 * 1024 * 1024) fail('Spec exceeds 2 MiB');
  let body = source, firstLine = 1, meta = {};
  if (source.startsWith('---\n')) {
    const end = source.indexOf('\n---\n',4);
    if (end < 0) fail('Unclosed frontmatter', {hint:'Add a closing --- line.'});
    meta = record(yaml(source.slice(4,end), {line:2,component:'frontmatter'}), {line:2});
    body = source.slice(end+5); firstLine = source.slice(0,end+5).split('\n').length;
  }
  const allowed = new Set(['schema','title','subtitle','lang','theme','mode','video','voice']);
  for (const key of Object.keys(meta)) if (!allowed.has(key)) fail(`Unknown frontmatter field: ${key}`,{component:'frontmatter'});
  meta = {...meta, ...Object.fromEntries(Object.entries(overrides).filter(([,v]) => v !== undefined))};
  meta.schema ??= 1; if (meta.schema !== 1) fail('Unsupported schema; use schema: 1');
  meta.title = textValue(meta.title || 'Explainer HTML');
  meta.lang ??= /[\u0e00-\u0e7f]/.test(source) ? 'th' : 'en';
  choice(meta.lang,['th','en']); meta.theme ??= 'shadcn'; choice(meta.theme,['shadcn','blueprint']);
  meta.mode ??= 'auto'; choice(meta.mode,['auto','light','dark']);
  if (meta.video !== undefined && ![true,false,'on','off'].includes(meta.video)) fail('video must be on or off');
  meta.video = meta.video === true || meta.video === 'on';
  meta.voice ??= 'auto'; choice(meta.voice,['auto','elevenlabs','local','system','off']);
  const sections = []; const intro = []; let current = null; let line = firstLine;
  for (const token of lexer(body, {gfm:true})) {
    const at = line; line += (token.raw.match(/\n/g)||[]).length;
    if (token.type === 'heading' && token.depth === 2) {
      current = {id:`scene-${sections.length+1}`, title:token.text, line:at, blocks:[], beats:[]}; sections.push(current);
      continue;
    }
    const blocks = current ? current.blocks : intro;
    if (token.type === 'code' && COMPONENTS.has(token.lang?.trim())) {
      const kind = token.lang.trim(), ctx = {line:at+1,component:kind};
      const value = yaml(token.text, ctx);
      if (kind === 'beats') {
        if (!current) fail('Place beats under a ## scene heading', ctx);
        for (const [i,b] of list(value,ctx).entries()) {
          record(b,ctx); textValue(b.narration,ctx);
          for (const key of Object.keys(b)) if (!['narration','focus','reveal','hide','state','duration'].includes(key)) fail(`Unknown beat field: ${key}`,ctx);
          for (const key of ['focus','reveal','hide']) if (b[key] !== undefined) list(b[key],ctx).forEach(id => identifier(id,ctx));
          if (b.duration !== undefined && (!Number.isFinite(b.duration) || b.duration <= 0)) fail('duration must be a positive number',ctx);
          if (b.state) record(b.state,ctx);
          current.beats.push({...b,id:`${current.id}-beat-${current.beats.length+1}`,line:at+i+1});
        }
      } else blocks.push({kind,value,line:at+1});
    } else blocks.push({kind:'markdown',text:token.raw,line:at});
  }
  if (!sections.length) sections.push({id:'scene-1', title:meta.title, line:firstLine, blocks:intro.splice(0),beats:[]});
  if (meta.video) for (const s of sections) if (!s.beats.length) fail(`Scene ${s.title} needs a beats block`,{line:s.line, component:'beats'});
  return {version:1,meta,intro,sections,source};
}
export function entities(mapping, ctx) {
  record(mapping,ctx);
  const out = Object.entries(mapping).map(([id,value]) => {
    identifier(id,ctx); const item = typeof value === 'string' ? {label:value} : record(value,ctx);
    textValue(item.label,ctx); return {...item,id};
  });
  if (!out.length) fail('At least one entity is required',ctx);
  return out;
}
