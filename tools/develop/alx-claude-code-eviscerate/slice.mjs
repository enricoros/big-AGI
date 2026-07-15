// slice.mjs - extract a real session SLICE spanning two consecutive turns plus the
// floating-state flush between them, annotated with every grouping id, so the report
// can draw how the logical ladder (L1..L4) serializes onto the flat tape (L0).
// Output: out/slice.json
import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS, saveJson } from './lib.mjs';

const short = (s, n = 6) => s ? String(s).slice(-n) : null;
const FLOATING = new Set(['last-prompt', 'ai-title', 'custom-title', 'agent-name', 'permission-mode', 'mode', 'queue-operation', 'summary', 'frame-link']);

function classify(j) {
  const t = j.type;
  if (t === 'user') {
    const c = j.message?.content;
    if (Array.isArray(c) && c.some(b => b?.type === 'tool_result')) return { k: 'result', tu: short(c.find(b => b?.type === 'tool_result')?.tool_use_id) };
    if (j.isMeta) return { k: 'meta' };
    return { k: 'prompt' };
  }
  if (t === 'assistant') {
    const b = Array.isArray(j.message?.content) ? j.message.content[0] : null;
    return { k: b?.type === 'tool_use' ? 'tool_use' : b?.type === 'thinking' ? 'thinking' : 'text', tu: b?.type === 'tool_use' ? short(b.id) : null, name: b?.name || null };
  }
  if (t === 'system') return { k: 'system', sub: j.subtype };
  if (t === 'file-history-snapshot') return { k: 'checkpoint' };
  if (t === 'attachment') return { k: 'attachment', sub: j.attachment?.type };
  if (FLOATING.has(t)) return { k: 'floating', sub: t };
  return { k: 'other', sub: t };
}

let best = null;
for (const proj of fs.readdirSync(PROJECTS, { withFileTypes: true })) {
  if (!proj.isDirectory()) continue;
  const pdir = path.join(PROJECTS, proj.name);
  for (const e of fs.readdirSync(pdir, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
    let txt;
    try { txt = fs.readFileSync(path.join(pdir, e.name), 'utf8'); } catch { continue; }
    const recs = [];
    let title = null;
    for (const l of txt.split('\n')) {
      if (!l) continue;
      try {
        const j = JSON.parse(l);
        if (j.type === 'custom-title') { title = j.customTitle; continue; }
        recs.push(j);
      } catch { /* skip */ }
    }
    // find prompt initiators (fresh promptId)
    const inits = [];
    for (let i = 0; i < recs.length; i++) {
      const j = recs[i];
      if (j.type !== 'user' || !j.promptId || j.isSidechain || j.isMeta) continue;
      const c = j.message?.content;
      if (Array.isArray(c) && c.some(b => b?.type === 'tool_result')) continue;
      if (inits.length && recs[inits[inits.length - 1]].promptId === j.promptId) continue;
      inits.push(i);
    }
    for (let a = 0; a + 2 < inits.length; a++) {
      const [i1, i2, i3] = [inits[a], inits[a + 1], inits[a + 2]];
      const span = i3 - i1;
      if (span < 16 || span > 30) continue;
      const slice = recs.slice(i1, i3);
      if (slice.some(r => r.isSidechain || r.type === 'progress')) continue;
      const kinds = slice.map(classify);
      const cycles = kinds.filter(x => x.k === 'tool_use').length;
      const floats = kinds.filter(x => x.k === 'floating').length;
      const cps = kinds.filter(x => x.k === 'checkpoint').length;
      const mids = new Set(slice.filter(r => r.type === 'assistant' && r.message?.id).map(r => r.message.id));
      if (cycles < 2 || floats < 3 || cps < 1 || mids.size < 3 || mids.size > 6) continue;
      const score = Date.parse(recs[i1].timestamp || 0) || 0;
      if (!best || score > best.score) {
        best = {
          score, project: proj.name, session: e.name.replace('.jsonl', ''), title,
          ts: recs[i1].timestamp, i2rel: i2 - i1,
          records: slice.map(j => ({
            ...classify(j),
            u: short(j.uuid, 6), mid: j.message?.id ? short(j.message.id, 5) : null,
            pid: j.promptId ? short(j.promptId, 5) : null,
            fhsMid: j.type === 'file-history-snapshot' ? short(j.messageId, 6) : null,
          })),
        };
      }
    }
  }
}
if (!best) { console.error('no suitable slice found'); process.exit(1); }
saveJson('slice', best);
console.log(`slice: ${best.session.slice(0, 8)} "${best.title || ''}" · ${best.records.length} records · turn2 at +${best.i2rel} · ${best.ts}`);
