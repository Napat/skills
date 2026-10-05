import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),errors=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
function equalFile(name,expected){try{if(hash(fs.readFileSync(path.join(root,name)))!==expected)errors.push(`Hash differs: ${name}`);}catch{errors.push(`Missing file: ${name}`);}}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'scripts/build-manifest.json'),'utf8'));
equalFile('scripts/render.mjs',manifest.bundle);for(const [file,sum]of Object.entries(manifest.inputs))equalFile(file,sum);
const vendor=JSON.parse(fs.readFileSync(path.join(root,'vendor/archify.lock.json'),'utf8'));if(vendor.version!=='3.0.1'||vendor.revision!=='2ab3cae7ac2c2a55d7386ca789d03c4fcd31816c')errors.push('Unexpected Archify revision');for(const [file,sum]of Object.entries(vendor.files))equalFile('vendor/archify/'+file,sum);
const skill=fs.readFileSync(path.join(root,'SKILL.md'),'utf8'),metadata=fs.readFileSync(path.join(root,'agents/openai.yaml'),'utf8');
if(!skill.startsWith('---\nname: explainer-html\n')||/\[TODO[:\]]/.test(skill))errors.push('Invalid skill scaffold');
for(const value of ['display_name: "Explainer HTML"','short_description: "Explain technical concepts with offline HTML and video"','default_prompt: "Use $explainer-html to explain this topic with a standalone offline HTML page."'])if(!metadata.includes(value))errors.push('UI metadata differs: '+value.split(':')[0]);
if(/allow_implicit_invocation:\s*false/.test(metadata))errors.push('Implicit invocation disabled unexpectedly');
const docs=['SKILL.md','THIRD_PARTY_NOTICES.md',...fs.readdirSync(path.join(root,'references')).map(n=>'references/'+n)];
let links=0;for(const file of docs){const text=fs.readFileSync(path.join(root,file),'utf8');for(const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){const target=match[1];if(/^(https?:|#)/.test(target))continue;const local=path.resolve(root,path.dirname(file),target.split('#')[0]);if(!local.startsWith(root+path.sep)||!fs.existsSync(local))errors.push(`Broken reference ${file}: ${target}`);links++;}}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(JSON.stringify({status:'passed',sourceFiles:Object.keys(manifest.inputs).length,vendorFiles:Object.keys(vendor.files).length,referenceLinks:links,metadata:'passed'}));
