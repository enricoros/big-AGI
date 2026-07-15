// toolsx.mjs - deep tool-interface census + subagent contract mapping.
// Scans session AND subagent tapes: per-tool parameter fill rates, finite value
// spaces, argument sizes, error rates, result sizes; Agent spawn inputs/outputs,
// per-agentType execution profiles, parallelism/depth/async relations.
// Output: out/toolsx.json
import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS, saveJson, bump, walkFiles } from './lib.mjs';

const VALID_NAME = /^[A-Za-z][\w:-]{0,60}$/;
const MAX_DISTINCT = 14;

const g = {
  iface: {},        // tool -> {n, sub, errN, resBytes, resMax, params:{}}
  agent: {
    n: 0, spawnTypes: {}, promptLen: { sum: 0, max: 0, buckets: {} }, descN: 0,
    inputKeys: {}, parallelMsgs: 0, parentResultKeys: {}, isAsync: {}, resolvedModel: {},
    totalTokensSum: 0, totalTokensN: 0, durMsSum: 0, durMsN: 0, outputFileN: 0,
  },
  subTypes: {},     // agentType -> profile
  totals: { calls: 0, paramFills: 0 },
};

const promptBucket = n => n < 200 ? '<200c' : n < 1000 ? '200-1k' : n < 4000 ? '1k-4k' : n < 12000 ? '4k-12k' : '12k+';

function trackParam(P, key, v) {
  const p = P[key] = P[key] || { n: 0, types: {}, vals: {}, open: false, distinct: 0, strLen: 0, strMax: 0, arrLen: 0, arrN: 0 };
  p.n++; g.totals.paramFills++;
  const ty = Array.isArray(v) ? 'array' : typeof v;
  bump(p.types, ty);
  if (ty === 'string') { p.strLen += v.length; if (v.length > p.strMax) p.strMax = v.length; }
  if (ty === 'array') { p.arrLen += v.length; p.arrN++; }
  if (!p.open && (ty === 'boolean' || ty === 'number' || (ty === 'string' && v.length <= 24))) {
    const key2 = String(v);
    if (!(key2 in p.vals) && p.distinct >= MAX_DISTINCT) { p.open = true; p.vals = {}; }
    else { if (!(key2 in p.vals)) p.distinct++; bump(p.vals, key2); }
  } else if (ty === 'string' || ty === 'object' || ty === 'array') {
    if (ty === 'string' && p.distinct === 0) p.open = true;  // long strings from the start = free-form
    else if (ty !== 'string') { /* objects/arrays: shape only */ }
  }
}

function scanTape(file, isSub, subProfile) {
  let txt;
  try { txt = fs.readFileSync(file, 'utf8'); } catch { return; }
  const useNames = new Map();          // toolu id -> name
  const msgAgentCount = new Map();     // message.id -> Agent calls
  let firstTs = null, lastTs = null;
  const msgSeen = new Set();
  const msgOut = new Map();
  for (const l of txt.split('\n')) {
    if (!l) continue;
    let j; try { j = JSON.parse(l); } catch { continue; }
    if (j.timestamp) { if (!firstTs) firstTs = j.timestamp; lastTs = j.timestamp; }
    const content = j.message?.content;
    if (j.type === 'assistant' && Array.isArray(content)) {
      if (j.message.id) {
        msgSeen.add(j.message.id);
        if (j.message.usage?.output_tokens) msgOut.set(j.message.id, Math.max(msgOut.get(j.message.id) || 0, j.message.usage.output_tokens));
      }
      for (const b of content) {
        if (b?.type !== 'tool_use') continue;
        const name = VALID_NAME.test(b.name || '') ? b.name : '(malformed)';
        useNames.set(b.id, name);
        g.totals.calls++;
        const I = g.iface[name] = g.iface[name] || { n: 0, sub: 0, errN: 0, resBytes: 0, resMax: 0, params: {} };
        I.n++; if (isSub) I.sub++;
        if (b.input && typeof b.input === 'object') for (const [k, v] of Object.entries(b.input)) trackParam(I.params, k, v);
        if (subProfile) bump(subProfile.tools, name);
        if (name === 'Agent' || name === 'Task') {
          const A = g.agent;
          A.n++;
          const inp = b.input || {};
          for (const k of Object.keys(inp)) bump(A.inputKeys, k);
          if (inp.subagent_type) bump(A.spawnTypes, inp.subagent_type);
          if (typeof inp.prompt === 'string') { A.promptLen.sum += inp.prompt.length; if (inp.prompt.length > A.promptLen.max) A.promptLen.max = inp.prompt.length; bump(A.promptLen.buckets, promptBucket(inp.prompt.length)); }
          if (inp.description) A.descN++;
          if (j.message.id) msgAgentCount.set(j.message.id, (msgAgentCount.get(j.message.id) || 0) + 1);
        }
      }
    }
    if (j.type === 'user' && Array.isArray(content)) {
      for (const b of content) {
        if (b?.type !== 'tool_result') continue;
        const name = useNames.get(b.tool_use_id);
        if (!name) continue;
        const I = g.iface[name];
        if (I) {
          if (b.is_error) I.errN++;
          const sz = JSON.stringify(b.content ?? '').length;
          I.resBytes += sz; if (sz > I.resMax) I.resMax = sz;
        }
        if ((name === 'Agent' || name === 'Task') && j.toolUseResult && typeof j.toolUseResult === 'object' && !Array.isArray(j.toolUseResult)) {
          const A = g.agent, r = j.toolUseResult;
          for (const k of Object.keys(r)) bump(A.parentResultKeys, k);
          if ('isAsync' in r) bump(A.isAsync, String(r.isAsync));
          if (r.resolvedModel) bump(A.resolvedModel, r.resolvedModel);
          if (typeof r.totalTokens === 'number') { A.totalTokensSum += r.totalTokens; A.totalTokensN++; }
          if (typeof r.totalDurationMs === 'number') { A.durMsSum += r.totalDurationMs; A.durMsN++; }
          if (r.outputFile) A.outputFileN++;
        }
      }
    }
    if (subProfile && j.type === 'result') {
      const rr = j.result;
      if (typeof rr === 'string') subProfile.resStr++;
      else if (rr && typeof rr === 'object') { subProfile.resObj++; for (const k of Object.keys(rr)) bump(subProfile.resKeys, k); }
    }
  }
  for (const [, cnt] of msgAgentCount) if (cnt >= 2) g.agent.parallelMsgs++;
  if (subProfile) {
    subProfile.tapes++;
    subProfile.msgs += msgSeen.size;
    for (const [, o] of msgOut) subProfile.outTok += o;
    if (firstTs && lastTs) subProfile.durMin += (Date.parse(lastTs) - Date.parse(firstTs)) / 60000;
  }
}

for (const proj of fs.readdirSync(PROJECTS, { withFileTypes: true })) {
  if (!proj.isDirectory()) continue;
  const pdir = path.join(PROJECTS, proj.name);
  for (const e of fs.readdirSync(pdir, { withFileTypes: true })) {
    const p = path.join(pdir, e.name);
    if (e.isFile() && e.name.endsWith('.jsonl')) scanTape(p, false, null);
    else if (e.isDirectory() && e.name !== 'memory') {
      const sub = path.join(p, 'subagents');
      if (!fs.existsSync(sub)) continue;
      for (const f of walkFiles(sub)) {
        if (!f.endsWith('.jsonl')) continue;
        let agentType = f.includes('/workflows/') ? 'workflow-subagent' : '?';
        try { agentType = JSON.parse(fs.readFileSync(f.replace(/\.jsonl$/, '.meta.json'), 'utf8')).agentType || agentType; } catch { /* keep */ }
        const prof = g.subTypes[agentType] = g.subTypes[agentType] || { tapes: 0, msgs: 0, outTok: 0, durMin: 0, tools: {}, resStr: 0, resObj: 0, resKeys: {} };
        scanTape(f, true, prof);
      }
    }
  }
  process.stderr.write('.');
}
process.stderr.write('\n');

// slim the params: drop vals for open params, keep top 8 values
for (const I of Object.values(g.iface)) {
  for (const p of Object.values(I.params)) {
    if (p.open || p.distinct > MAX_DISTINCT) { p.vals = null; p.open = true; }
    else p.vals = Object.fromEntries(Object.entries(p.vals).sort((a, b) => b[1] - a[1]).slice(0, 8));
  }
}
saveJson('toolsx', g);
console.log(`tools: ${Object.keys(g.iface).length} names, ${g.totals.calls} calls, ${g.totals.paramFills} param fills · agent spawns ${g.agent.n} (parallel msgs ${g.agent.parallelMsgs}) · subagent types ${Object.keys(g.subTypes).length}`);
