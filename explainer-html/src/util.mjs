import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VERSION = '0.1.0';
export const hash = data => createHash('sha256').update(data).digest('hex');
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const jsonText = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
export class ExplainError extends Error {
  constructor(message, {line = 1, component = 'document', code = 'invalid-input', hint} = {}) {
    super(message); Object.assign(this, {name:'ExplainError', line, component, code, hint});
  }
}
export function fail(message, context) { throw new ExplainError(message, context); }
export function atomicWrite(file, data) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  if (fs.existsSync(file) && !fs.lstatSync(file).isFile()) throw new Error('Output must be a regular file');
  const staged = `${file}.${randomUUID()}.tmp`;
  try { fs.writeFileSync(staged, data, {flag:'wx', mode:0o600}); fs.renameSync(staged, file); }
  finally { try { fs.unlinkSync(staged); } catch {} }
}
export function run(command, args, {timeout = 60000, env = process.env, cwd, signal} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {env, cwd, signal, stdio:['ignore','pipe','pipe']});
    let stdout = '', stderr = ''; let expired = false;
    const timer = setTimeout(() => {expired = true; child.kill('SIGKILL');}, timeout);
    child.stdout.on('data', d => { if (stdout.length < 4e6) stdout += d; });
    child.stderr.on('data', d => { if (stderr.length < 16000) stderr += d; });
    child.on('error', e => {clearTimeout(timer); reject(e);});
    child.on('close', code => { clearTimeout(timer); const result = {code, stdout, stderr};
      if (code === 0 && !expired) resolve(result);
      else reject(Object.assign(new Error(expired ? `${path.basename(command)} timed out` : `${path.basename(command)} exited ${code}: ${stderr.slice(0,1500)}`), result));
    });
  });
}
export function identifier(value, ctx) {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)) fail(`Invalid ID: ${String(value)}`, {...ctx, hint:'Use a letter followed by letters, numbers, hyphens or underscores.'});
  return value;
}
export function record(value, ctx) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Expected a mapping', ctx); return value; }
export function list(value, ctx) { if (!Array.isArray(value)) fail('Expected a list', ctx); return value; }
export function textValue(value, ctx) { if (typeof value !== 'string' || !value.trim()) fail('Expected non-empty text', ctx); return value; }
export function choice(value, choices, ctx) { if (!choices.includes(value)) fail(`Expected ${choices.join(' | ')}; got ${value}`, ctx); return value; }
