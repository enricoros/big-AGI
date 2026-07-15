import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const CLAUDE_HOME = path.join(os.homedir(), '.claude');
export const PROJECTS = path.join(CLAUDE_HOME, 'projects');
export const OUT = new URL('./out/', import.meta.url).pathname;

export function ensureOut() {
  fs.mkdirSync(OUT, { recursive: true });
}

export function saveJson(name, data) {
  ensureOut();
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 1));
  console.log(`  out/${name}.json`);
}

export function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(OUT, `${name}.json`), 'utf8'));
}

// deep-truncate a record for exemplar capture: strings clipped, arrays capped, depth-limited
export function truncDeep(v, depth = 7, strMax = 90, arrMax = 5) {
  if (depth <= 0) return '…(depth)';
  if (typeof v === 'string') return v.length > strMax ? v.slice(0, strMax) + `…(+${v.length - strMax}c)` : v;
  if (Array.isArray(v)) {
    const out = v.slice(0, arrMax).map(x => truncDeep(x, depth - 1, strMax, arrMax));
    if (v.length > arrMax) out.push(`…(+${v.length - arrMax} items)`);
    return out;
  }
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k] = truncDeep(v[k], depth - 1, strMax, arrMax);
    return out;
  }
  return v;
}

// short text snippet from a message.content (string or block array)
export function contentSnippet(content, max = 70) {
  let s = '';
  if (typeof content === 'string') s = content;
  else if (Array.isArray(content)) {
    const tb = content.find(b => b && b.type === 'text' && b.text);
    if (tb) s = tb.text;
    else if (content[0]) s = `(${content[0].type})`;
  }
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export function bump(obj, key, n = 1) {
  obj[key] = (obj[key] || 0) + n;
}

export function* walkFiles(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkFiles(p);
    else if (e.isFile()) yield p;
  }
}

export const fmtBytes = n => n >= 1 << 30 ? (n / (1 << 30)).toFixed(2) + ' GB' : n >= 1 << 20 ? (n / (1 << 20)).toFixed(1) + ' MB' : n >= 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' B';
export const fmtNum = n => (n ?? 0).toLocaleString('en-US');
