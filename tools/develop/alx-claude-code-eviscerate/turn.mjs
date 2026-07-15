// turn.mjs - extract ONE real agentic turn with its full identity system:
// sessionId, promptId, uuid/parentUuid chain, message.id spans, tool_use/tool_result
// pairing, sourceToolAssistantUUID backlinks, file-history-snapshot messageId pointer,
// and (preferred) an Agent spawn matched to its subagent sidecar tape.
// Output: out/turn.json (ids trimmed, no content beyond a tiny prompt snippet)
import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS, saveJson, contentSnippet } from './lib.mjs';

const short = (s, n = 8) => s ? String(s).slice(-n) : null;

function parseTape(file) {
  let txt;
  try { txt = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const recs = [];
  for (const l of txt.split('\n')) {
    if (!l) continue;
    try { recs.push(JSON.parse(l)); } catch { /* skip */ }
  }
  return recs;
}

// score candidate turns in one tape; returns best candidate or null
function findTurn(recs, file) {
  const out = [];
  // indices of prompt-initiating user records (fresh promptId, non-meta, non-tool-result)
  for (let i = 0; i < recs.length; i++) {
    const j = recs[i];
    if (j.type !== 'user' || !j.promptId || j.isSidechain || j.isMeta) continue;
    const c = j.message?.content;
    if (Array.isArray(c) && c.some(b => b?.type === 'tool_result')) continue;
    // slice until next prompt-initiating user record
    let end = recs.length;
    for (let k = i + 1; k < recs.length; k++) {
      const r = recs[k];
      if (r.type === 'user' && r.promptId && r.promptId !== j.promptId && !r.isMeta) { end = k; break; }
      if (r.type === 'custom-title' || r.type === 'ai-title') continue;
    }
    const slice = recs.slice(i, end).filter(r => ['user', 'assistant', 'system', 'attachment'].includes(r.type) && !r.isSidechain);
    if (slice.length < 7 || slice.length > 15) continue;
    if (slice.some(r => r.type === 'progress')) continue;
    const msgIds = new Set(slice.filter(r => r.type === 'assistant' && r.message?.id).map(r => r.message.id));
    if (msgIds.size < 3 || msgIds.size > 4) continue;
    const toolUses = slice.flatMap(r => r.type === 'assistant' && Array.isArray(r.message?.content) ? r.message.content.filter(b => b?.type === 'tool_use') : []);
    if (toolUses.length < 2 || toolUses.length > 4) continue;
    const spawnUse = toolUses.find(b => b.name === 'Agent' || b.name === 'Task');
    out.push({ i, end, slice, msgIds: msgIds.size, toolUses: toolUses.length, spawnUse, ts: j.timestamp });
  }
  if (!out.length) return null;
  out.sort((a, b) => (b.spawnUse ? 1 : 0) - (a.spawnUse ? 1 : 0) || (b.ts || '').localeCompare(a.ts || ''));
  return { ...out[0], file };
}

let best = null;
for (const proj of fs.readdirSync(PROJECTS, { withFileTypes: true })) {
  if (!proj.isDirectory()) continue;
  const pdir = path.join(PROJECTS, proj.name);
  for (const e of fs.readdirSync(pdir, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
    const recs = parseTape(path.join(pdir, e.name));
    if (!recs) continue;
    const cand = findTurn(recs, path.join(pdir, e.name));
    if (!cand) continue;
    // attach preceding snapshot if it belongs to this prompt
    const idx = recs.indexOf(cand.slice[0]);
    const prev = recs[idx - 1];
    if (prev?.type === 'file-history-snapshot' && prev.messageId === cand.slice[0].uuid) cand.fhs = prev;
    // sidecar match for the spawn
    if (cand.spawnUse) {
      const sub = path.join(pdir, path.basename(e.name, '.jsonl'), 'subagents');
      cand.spawnMeta = null;
      if (fs.existsSync(sub)) {
        for (const f of fs.readdirSync(sub)) {
          if (!f.endsWith('.meta.json')) continue;
          try {
            const m = JSON.parse(fs.readFileSync(path.join(sub, f), 'utf8'));
            if (m.toolUseId === cand.spawnUse.id) {
              const tapeF = path.join(sub, f.replace('.meta.json', '.jsonl'));
              const subRecs = fs.existsSync(tapeF) ? parseTape(tapeF) : [];
              cand.spawnMeta = {
                fileName: f.replace('.meta.json', '.jsonl'),
                agentType: m.agentType, toolUseId: m.toolUseId, spawnDepth: m.spawnDepth ?? null,
                records: subRecs.length,
                startedKey: subRecs.find(r => r.type === 'started')?.key || null,
                hasResult: subRecs.some(r => r.type === 'result'),
              };
              break;
            }
          } catch { /* skip */ }
        }
      }
    }
    const better = !best
      || (!!cand.spawnMeta && !best.spawnMeta)
      || (!!cand.spawnMeta === !!best.spawnMeta && (cand.ts || '') > (best.ts || ''));
    if (better) best = cand;
  }
}
if (!best) { console.error('no suitable turn found'); process.exit(1); }

// trim records for the diagram
const first = best.slice[0];
const records = (best.fhs ? [best.fhs] : []).concat(best.slice).map(j => {
  const blocks = Array.isArray(j.message?.content) ? j.message.content.map(b => ({
    t: b.type, id: short(b.id || b.tool_use_id), name: b.name || null,
  })) : (typeof j.message?.content === 'string' ? [{ t: 'text(str)' }] : []);
  return {
    type: j.type, sub: j.subtype || null,
    u: short(j.uuid), p: short(j.parentUuid),
    mid: j.message?.id ? short(j.message.id, 6) : null,
    rid: j.requestId ? short(j.requestId, 6) : null,
    stop: j.message?.stop_reason ?? undefined,
    blocks,
    src: short(j.sourceToolAssistantUUID),
    tur: j.toolUseResult ? (Array.isArray(j.toolUseResult) ? 'array' : typeof j.toolUseResult) : null,
    fhsMid: j.type === 'file-history-snapshot' ? short(j.messageId) : null,
    nBackups: j.type === 'file-history-snapshot' ? Object.keys(j.snapshot?.trackedFileBackups || {}).length : null,
  };
});

saveJson('turn', {
  extractedFrom: path.relative(PROJECTS, best.file),
  sessionId: short(first.sessionId),
  promptId: short(first.promptId, 6),
  version: first.version, ts: first.timestamp,
  snippet: contentSnippet(first.message?.content, 60),
  records,
  spawn: best.spawnMeta ? { ...best.spawnMeta, startedKey: best.spawnMeta.startedKey ? 'v2:' + short(best.spawnMeta.startedKey, 8) : null } : null,
});
console.log(`turn: ${best.file.split('/').slice(-1)[0]} msgs=${best.msgIds} tools=${best.toolUses} spawn=${best.spawnMeta ? best.spawnMeta.agentType : 'no'} records=${records.length}`);
