// schema.mjs - level-3 schema inference over the session tapes: per-type field
// censuses (presence, type unions, finite value sets) and per-subtype clusters,
// enough to emit annotated TypeScript definitions in the report.
// Output: out/schema.json
import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS, saveJson, bump } from './lib.mjs';

const ENV_KEYS = new Set(['uuid', 'parentUuid', 'isSidechain', 'sessionId', 'timestamp', 'version', 'cwd', 'gitBranch', 'userType', 'entrypoint', 'type']);
const fc = () => ({});
function track(F, k, v) {
  const f = F[k] = F[k] || { n: 0, types: {}, vals: {}, open: false, distinct: 0 };
  f.n++;
  const ty = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
  bump(f.types, ty);
  if (!f.open && (ty === 'boolean' || ty === 'number' || ty === 'null' || (ty === 'string' && v.length <= 28))) {
    const key = String(v);
    if (!(key in f.vals) && f.distinct >= 10) { f.open = true; f.vals = {}; }
    else { if (!(key in f.vals)) f.distinct++; bump(f.vals, key); }
  } else if (ty === 'string') f.open = true;
}
const trackAll = (F, obj, skip = ENV_KEYS) => { for (const [k, v] of Object.entries(obj)) if (!skip.has(k)) track(F, k, v); };

const g = {
  env: { n: 0, fields: fc() },
  user: { n: 0, fields: fc(), blocks: {}, turPerTool: {}, turShapes: {} },
  assistant: { n: 0, fields: fc(), message: fc(), usage: fc(), blocks: {} },
  system: { n: 0, subs: {} },
  attachment: { n: 0, subs: {} },
  progress: { n: 0, fields: fc(), data: fc(), subs: {} },
  queue: { n: 0, subs: {} },
  fhs: { n: 0, fields: fc(), backupEntry: fc() },
  fhd: { n: 0, fields: fc() },
  floating: {},   // type -> {n, fields}
};

const useNames = new Map();
for (const proj of fs.readdirSync(PROJECTS, { withFileTypes: true })) {
  if (!proj.isDirectory()) continue;
  const pdir = path.join(PROJECTS, proj.name);
  for (const e of fs.readdirSync(pdir, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
    let txt;
    try { txt = fs.readFileSync(path.join(pdir, e.name), 'utf8'); } catch { continue; }
    useNames.clear();
    for (const l of txt.split('\n')) {
      if (!l) continue;
      let j; try { j = JSON.parse(l); } catch { continue; }
      const t = j.type;
      if (j.uuid) { g.env.n++; for (const k of ENV_KEYS) if (k in j) track(g.env.fields, k, j[k]); if ('slug' in j) track(g.env.fields, 'slug', j.slug); if ('forkedFrom' in j) track(g.env.fields, 'forkedFrom', 'object'); if ('agentId' in j) track(g.env.fields, 'agentId', 'string'); }
      const content = j.message?.content;

      if (t === 'user') {
        g.user.n++;
        trackAll(g.user.fields, j, new Set([...ENV_KEYS, 'slug', 'agentId', 'forkedFrom']));
        if (Array.isArray(content)) for (const b of content) {
          if (!b?.type) continue;
          const B = g.user.blocks[b.type] = g.user.blocks[b.type] || fc();
          trackAll(B, b, new Set());
          if (b.type === 'tool_result' && typeof b.content !== 'string') track(B, 'content', Array.isArray(b.content) ? 'array' : typeof b.content);
        }
        if (j.toolUseResult !== undefined) {
          const tur = j.toolUseResult;
          bump(g.user.turShapes, Array.isArray(tur) ? 'array' : typeof tur);
          const rb = Array.isArray(content) ? content.find(b => b?.type === 'tool_result') : null;
          const name = rb ? useNames.get(rb.tool_use_id) : null;
          if (name) {
            const T = g.user.turPerTool[name] = g.user.turPerTool[name] || { n: 0, keys: fc(), wire: { n: 0, types: {}, len: 0 }, parsedLen: 0, parsedStr: 0 };
            // wire copy: the tool_result block that gets re-sent to the API
            T.wire.n++;
            bump(T.wire.types, typeof rb.content === 'string' ? 'string' : Array.isArray(rb.content) ? rb.content.map(b => b?.type).join('+') || 'array' : typeof rb.content);
            T.wire.len += JSON.stringify(rb.content ?? '').length;
            // parsed copy: the app-side twin
            T.parsedLen += JSON.stringify(tur).length;
            if (typeof tur === 'string') T.parsedStr++;
            if (tur && typeof tur === 'object' && !Array.isArray(tur)) {
              T.n++;
              for (const [k, v] of Object.entries(tur)) track(T.keys, k, typeof v === 'object' ? (Array.isArray(v) ? 'array' : 'object') : v);
            }
          }
        }
      } else if (t === 'assistant') {
        g.assistant.n++;
        trackAll(g.assistant.fields, j, new Set([...ENV_KEYS, 'message', 'slug', 'agentId', 'forkedFrom']));
        if (j.message) {
          trackAll(g.assistant.message, j.message, new Set(['content', 'usage']));
          if (j.message.usage) trackAll(g.assistant.usage, j.message.usage, new Set());
          if (Array.isArray(content)) for (const b of content) {
            if (!b?.type) continue;
            const B = g.assistant.blocks[b.type] = g.assistant.blocks[b.type] || fc();
            for (const [k, v] of Object.entries(b)) track(B, k, k === 'thinking' || k === 'signature' || k === 'text' ? 'string' : k === 'input' ? 'object' : v);
            if (b.type === 'tool_use') useNames.set(b.id, b.name);
          }
        }
      } else if (t === 'system') {
        g.system.n++;
        const S = g.system.subs[j.subtype || '?'] = g.system.subs[j.subtype || '?'] || { n: 0, fields: fc() };
        S.n++;
        trackAll(S.fields, j, new Set([...ENV_KEYS, 'subtype', 'slug', 'agentId', 'forkedFrom', 'session_id', 'sessionKind', 'origin']));
      } else if (t === 'attachment') {
        g.attachment.n++;
        const at = j.attachment?.type || '?';
        const S = g.attachment.subs[at] = g.attachment.subs[at] || { n: 0, fields: fc() };
        S.n++;
        if (j.attachment) trackAll(S.fields, j.attachment, new Set(['type']));
      } else if (t === 'progress') {
        g.progress.n++;
        trackAll(g.progress.fields, j, new Set([...ENV_KEYS, 'data', 'slug', 'agentId', 'forkedFrom', 'session_id']));
        const dt = j.data?.type || '?';
        const S = g.progress.subs[dt] = g.progress.subs[dt] || { n: 0, fields: fc() };
        S.n++;
        if (j.data) trackAll(S.fields, j.data, new Set(['type']));
      } else if (t === 'queue-operation') {
        g.queue.n++;
        const S = g.queue.subs[j.operation || '?'] = g.queue.subs[j.operation || '?'] || { n: 0, fields: fc() };
        S.n++;
        trackAll(S.fields, j, new Set(['type', 'operation']));
      } else if (t === 'file-history-snapshot') {
        g.fhs.n++;
        trackAll(g.fhs.fields, j, new Set(['type']));
        const backups = j.snapshot?.trackedFileBackups;
        if (backups) for (const v of Object.values(backups).slice(0, 2)) if (v && typeof v === 'object') trackAll(g.fhs.backupEntry, v, new Set());
      } else if (t === 'file-history-delta') {
        g.fhd.n++;
        trackAll(g.fhd.fields, j, new Set(['type']));
      } else if (t && !j.uuid) {
        const F = g.floating[t] = g.floating[t] || { n: 0, fields: fc() };
        F.n++;
        trackAll(F.fields, j, new Set(['type']));
      }
    }
  }
  process.stderr.write('.');
}
process.stderr.write('\n');

// slim: keep top 8 vals, drop open vals
const slim = F => { for (const f of Object.values(F)) { if (f.open || f.distinct > 10) { f.vals = null; } else f.vals = Object.fromEntries(Object.entries(f.vals).sort((a, b) => b[1] - a[1]).slice(0, 8)); } };
slim(g.env.fields); slim(g.user.fields); slim(g.assistant.fields); slim(g.assistant.message); slim(g.assistant.usage);
for (const B of Object.values(g.user.blocks)) slim(B);
for (const B of Object.values(g.assistant.blocks)) slim(B);
for (const S of Object.values(g.system.subs)) slim(S.fields);
for (const S of Object.values(g.attachment.subs)) slim(S.fields);
for (const S of Object.values(g.progress.subs)) slim(S.fields);
for (const S of Object.values(g.queue.subs)) slim(S.fields);
for (const T of Object.values(g.user.turPerTool)) slim(T.keys);
slim(g.fhs.fields); slim(g.fhs.backupEntry); slim(g.fhd.fields); slim(g.progress.fields);
for (const F of Object.values(g.floating)) slim(F.fields);

saveJson('schema', g);
console.log(`schema: env ${g.env.n} · user ${g.user.n} · assistant ${g.assistant.n} · system subs ${Object.keys(g.system.subs).length} · attachment subs ${Object.keys(g.attachment.subs).length} · turPerTool ${Object.keys(g.user.turPerTool).length}`);
