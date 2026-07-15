// slice2.mjs - a richer serialization slice for the drill view: must contain a
// parallel-call message (2+ tool_use in one message.id), preferably with eager
// streaming (results interleaved between same-mid records) and an Agent spawn with
// its sidecar tape. Output: out/slice2.json (condensed records + child-tape head).
import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS, saveJson } from './lib.mjs';

const short = (s, n = 6) => s ? String(s).slice(-n) : null;
const FLOATING = new Set(['last-prompt', 'ai-title', 'custom-title', 'agent-name', 'permission-mode', 'mode', 'queue-operation', 'summary', 'frame-link']);

function kindOf(j) {
  const t = j.type;
  if (t === 'user') {
    const c = j.message?.content;
    if (Array.isArray(c)) {
      const tr = c.find(b => b?.type === 'tool_result');
      if (tr) return { k: 'result', tu: short(tr.tool_use_id) };
    }
    return { k: j.isMeta ? 'meta' : 'prompt' };
  }
  if (t === 'assistant') {
    const b = Array.isArray(j.message?.content) ? j.message.content[0] : null;
    return { k: b?.type === 'tool_use' ? 'tool_use' : b?.type === 'thinking' ? 'thinking' : 'text', tu: b?.type === 'tool_use' ? short(b.id) : null, name: b?.name || null, fullTu: b?.type === 'tool_use' ? b.id : null };
  }
  if (t === 'system') return { k: 'system', sub: j.subtype };
  if (t === 'file-history-snapshot') return { k: 'checkpoint', upd: !!j.isSnapshotUpdate };
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
    let recs;
    try { recs = fs.readFileSync(path.join(pdir, e.name), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { continue; }
    recs = recs.filter(r => !['custom-title', 'agent-name'].includes(r.type));
    const inits = [];
    for (let i = 0; i < recs.length; i++) {
      const j = recs[i];
      if (j.type === 'user' && j.promptId && !j.isSidechain && !j.isMeta && !(Array.isArray(j.message?.content) && j.message.content.some(b => b?.type === 'tool_result'))
        && !(inits.length && recs[inits[inits.length - 1]].promptId === j.promptId)) inits.push(i);
    }
    for (let a = 0; a < inits.length; a++) {
      for (const endIdx of [inits[a + 1], inits[a + 2]]) {
        const end = endIdx ?? recs.length;
        const len = end - inits[a];
        if (len < 14 || len > 40) continue;
        const slice = recs.slice(inits[a], end);
        if (slice.some(r => r.isSidechain || r.type === 'progress')) continue;
        // parallel + eager detection
        const midIdx = new Map();
        slice.forEach((r, i) => { if (r.type === 'assistant' && r.message?.id) { if (!midIdx.has(r.message.id)) midIdx.set(r.message.id, []); midIdx.get(r.message.id).push(i); } });
        let parallel = false, eager = false;
        for (const [, ix] of midIdx) {
          const uses = ix.filter(i => (slice[i].message.content || []).some(b => b?.type === 'tool_use'));
          if (uses.length >= 2) parallel = true;
          for (let k = 1; k < ix.length; k++) if (slice.slice(ix[k - 1] + 1, ix[k]).some(r => r.type === 'user')) eager = true;
        }
        if (!parallel) continue;
        const spawnUse = slice.flatMap(r => r.type === 'assistant' && Array.isArray(r.message?.content) ? r.message.content.filter(b => b?.type === 'tool_use' && (b.name === 'Agent' || b.name === 'Task')) : [])[0];
        let spawn = null;
        const spawnAck = spawnUse ? slice.find(r => r.type === 'user' && Array.isArray(r.message?.content) && r.message.content.some(b => b?.type === 'tool_result' && b.tool_use_id === spawnUse.id)) : null;
        const spawnIsAsync = spawnAck?.toolUseResult && typeof spawnAck.toolUseResult === 'object' ? !!spawnAck.toolUseResult.isAsync : false;
        if (spawnUse) {
          const sd = path.join(pdir, e.name.replace('.jsonl', ''), 'subagents');
          if (fs.existsSync(sd)) for (const f of fs.readdirSync(sd)) {
            if (!f.endsWith('.meta.json')) continue;
            try {
              const m = JSON.parse(fs.readFileSync(path.join(sd, f), 'utf8'));
              if (m.toolUseId === spawnUse.id) {
                const cr = fs.readFileSync(path.join(sd, f.replace('.meta.json', '.jsonl')), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
                spawn = {
                  file: f.replace('.meta.json', '.jsonl'), agentType: m.agentType, toolUseId: short(m.toolUseId), total: cr.length, isAsync: spawnIsAsync,
                  sessionId: short(cr[0]?.sessionId, 8), isSidechain: !!cr.find(r => r.isSidechain), agentId: cr.find(r => r.agentId)?.agentId?.slice(0, 8) || null,
                  head: cr.slice(0, 7).map(j => ({ ...kindOf(j), mid: j.message?.id ? short(j.message.id, 4) : null })),
                  lastKind: kindOf(cr[cr.length - 1]).k,
                };
                break;
              }
            } catch { /**/ }
          }
        }
        const floats = slice.filter(r => FLOATING.has(r.type)).length;
        const cps = slice.filter(r => r.type === 'file-history-snapshot').length;
        const score = (spawn ? 100 : 0) + (eager ? 50 : 0) + (floats >= 2 ? 10 : 0) + (cps ? 10 : 0) - len * 0.2 + (Date.parse(recs[inits[a]].timestamp || 0) || 0) / 1e13;
        if (!best || score > best.score) {
          const byU = new Map(slice.filter(r => r.uuid).map(r => [r.uuid, r]));
          best = {
            score, project: proj.name, session: e.name.replace('.jsonl', ''), ts: recs[inits[a]].timestamp,
            eager, spawn,
            records: slice.map(j => ({
              ...kindOf(j), u: short(j.uuid), mid: j.message?.id ? short(j.message.id, 5) : null,
              pid: short(j.promptId, 5),
              fhsKind: j.type === 'file-history-snapshot' ? (byU.get(j.messageId) ? (byU.get(j.messageId).type === 'user' ? 'prompt' : 'assistant') : 'fwd') : null,
            })),
          };
        }
      }
    }
  }
}
if (!best) { console.error('no rich slice found'); process.exit(1); }
saveJson('slice2', best);
console.log(`slice2: ${best.session.slice(0, 8)} · ${best.records.length} records · eager=${best.eager} spawn=${best.spawn ? best.spawn.agentType + ' (' + best.spawn.total + ' recs, sess ' + best.spawn.sessionId + ')' : 'no'} · ${best.ts}`);
