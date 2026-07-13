import fs from 'node:fs';
import path from 'node:path';
import { OUT, apiKey, MODEL, save } from './lib.mjs';

const load = id => JSON.parse(fs.readFileSync(path.join(OUT, `${id}.json`), 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));

// non-streaming POST -> {status, body}
async function callJson(body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey(), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json; try { json = await res.json(); } catch { json = { parseError: true }; }
  return { status: res.status, body: json };
}

const results = [];
function record(name, hypothesis, r, extra = {}) {
  const ok = r.status === 200;
  const errType = r.body?.error?.type;
  const errMsg = r.body?.error?.message;
  const stop = r.body?.stop_reason;
  const usage = r.body?.usage;
  results.push({ name, hypothesis, status: r.status, stop, errType, errMsg, usage, ...extra });
  console.log(`\n[${name}] HTTP ${r.status} ${ok ? 'stop=' + stop : errType}`);
  console.log('   hyp: ' + hypothesis);
  if (!ok) console.log('   ERR: ' + (errMsg || '').slice(0, 260));
  else console.log('   usage: in=' + usage?.input_tokens + ' out=' + usage?.output_tokens + ' stu=' + JSON.stringify(usage?.server_tool_use || {}));
}

// ---------- content-type probe of code_execution_tool_result across scenarios ----------
console.log('===== code_execution_tool_result content types =====');
for (const id of ['s3_ptc_custom', 's2a_hosted_dynamic', 's4_ptc_plus_search', 's6a_response_excluded']) {
  const d = load(id);
  const types = new Set();
  d.turns.forEach(t => (t.content || []).forEach(b => {
    if (b.type === 'code_execution_tool_result') types.add(b.content?.type);
  }));
  console.log(`  ${id}: ${[...types].join(', ') || '(none)'}`);
}

const METRIC = {
  name: 'lookup_metric',
  description: 'Look up the metric for an entity. Returns JSON {"entity","score","unit"}.',
  input_schema: { type: 'object', properties: { entity: { type: 'string' } }, required: ['entity'] },
  allowed_callers: ['code_execution_20260120'],
};
const CE = { type: 'code_execution_20260120', name: 'code_execution' };

// ============ R1: S3 followup with FULL history (baseline: does PTC conversation continue?) ============
{
  const d = load('s3_ptc_custom');
  const container = d.turns.find(t => t.container)?.container?.id;
  const msgs = clone(d.finalMessages).concat([{ role: 'user', content: 'Now, which single entity has the LOWEST score? One line.' }]);
  const r = await callJson({ model: MODEL, max_tokens: 1024, messages: msgs, tools: [CE, METRIC], ...(container ? { container } : {}) });
  record('R1_s3_followup_full', 'Continue after PTC with full history incl nested tool_use/tool_result -> 200', r);
}

// ============ R2: S3 followup but STRIP the nested PTC tool_use + tool_result pairs ============
{
  const d = load('s3_ptc_custom');
  const container = d.turns.find(t => t.container)?.container?.id;
  const msgs = clone(d.finalMessages);
  // msgs: [user, assistant(text+code_exec+N tool_use), user(N tool_result), assistant(code_exec_result+text)]
  const asstIdx = msgs.findIndex(m => m.role === 'assistant' && m.content.some(b => b.type === 'tool_use'));
  msgs[asstIdx].content = msgs[asstIdx].content.filter(b => b.type !== 'tool_use'); // drop N tool_use
  const trIdx = msgs.findIndex(m => m.role === 'user' && Array.isArray(m.content) && m.content.some(b => b.type === 'tool_result'));
  msgs.splice(trIdx, 1); // drop the tool_result user message
  msgs.push({ role: 'user', content: 'Now, which single entity has the LOWEST score? One line.' });
  const r = await callJson({ model: MODEL, max_tokens: 1024, messages: msgs, tools: [CE, METRIC], ...(container ? { container } : {}) });
  record('R2_s3_strip_nested_ptc', 'Drop the code-exec nested tool_use + tool_result pairs, keep code_execution_tool_result -> does referential integrity 400?', r);
}

// ============ R3: resume PENDING S3 turn0 but WITHOUT the code_execution tool in tools[] ============
{
  const d = load('s3_ptc_custom');
  const container = d.turns.find(t => t.container)?.container?.id;
  const t0 = d.turns[0];
  const toolResults = t0.content.filter(b => b.type === 'tool_use').map(b => ({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify({ entity: b.input.entity, score: 1, unit: 'points' }) }));
  const msgs = [ clone(d.finalMessages[0]), { role: 'assistant', content: t0.content }, { role: 'user', content: toolResults } ];
  const r = await callJson({ model: MODEL, max_tokens: 1024, messages: msgs, tools: [METRIC], ...(container ? { container } : {}) }); // NO CE tool
  record('R3_resume_ptc_without_ce_tool', 'Resume paused PTC without the code_execution tool present -> expect 400', r);
}

// ============ R4: S2a (dynamic full) followup, STRIP nested hosted web_search/web_fetch pairs ============
{
  const d = load('s2a_hosted_dynamic');
  const container = d.turns.find(t => t.container)?.container?.id;
  const msgs = clone(d.finalMessages);
  const asst = msgs.find(m => m.role === 'assistant');
  const before = asst.content.length;
  asst.content = asst.content.filter(b => !(b.type === 'server_tool_use' && (b.name === 'web_search' || b.name === 'web_fetch')) && b.type !== 'web_search_tool_result' && b.type !== 'web_fetch_tool_result');
  msgs.push({ role: 'user', content: 'Thanks. In one line, restate just the Iceland population number.' });
  const r = await callJson({ model: MODEL, max_tokens: 512, messages: msgs, tools: [{ type: 'web_search_20260318', name: 'web_search', max_uses: 5 }, { type: 'web_fetch_20260318', name: 'web_fetch', max_uses: 3 }], ...(container ? { container } : {}) });
  record('R4_s2a_strip_nested_hosted', `Drop nested hosted search/fetch pairs (kept code_execution+result), removed ${before - asst.content.length} blocks -> is the code-exec result self-sufficient?`, r);
}

// ============ R4b: S2a followup FULL (baseline for R4) ============
{
  const d = load('s2a_hosted_dynamic');
  const container = d.turns.find(t => t.container)?.container?.id;
  const msgs = clone(d.finalMessages).concat([{ role: 'user', content: 'Thanks. In one line, restate just the Iceland population number.' }]);
  const r = await callJson({ model: MODEL, max_tokens: 512, messages: msgs, tools: [{ type: 'web_search_20260318', name: 'web_search', max_uses: 5 }, { type: 'web_fetch_20260318', name: 'web_fetch', max_uses: 3 }], ...(container ? { container } : {}) });
  record('R4b_s2a_followup_full', 'Baseline: S2a followup with nested pairs intact -> 200', r);
}

// ============ R5: S2b (direct search) followup with encrypted_content DELETED from results ============
{
  const d = load('s2b_hosted_direct');
  const msgs = clone(d.finalMessages);
  const asst = msgs.find(m => m.role === 'assistant');
  let stripped = 0;
  for (const b of asst.content) if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const r of b.content) if (r.encrypted_content) { delete r.encrypted_content; stripped++; }
  msgs.push({ role: 'user', content: 'In one line, restate the population.' });
  const r = await callJson({ model: MODEL, max_tokens: 512, messages: msgs, tools: [{ type: 'web_search_20260318', name: 'web_search', max_uses: 5, allowed_callers: ['direct'] }] });
  record('R5_s2b_drop_encrypted', `Direct-search result with encrypted_content deleted from ${stripped} results -> expect 400 (1st-party hosted MUST round-trip)`, r);
}

// ============ R5b: S2b followup unchanged (baseline for R5) ============
{
  const d = load('s2b_hosted_direct');
  const msgs = clone(d.finalMessages).concat([{ role: 'user', content: 'In one line, restate the population.' }]);
  const r = await callJson({ model: MODEL, max_tokens: 512, messages: msgs, tools: [{ type: 'web_search_20260318', name: 'web_search', max_uses: 5, allowed_callers: ['direct'] }] });
  record('R5b_s2b_followup_full', 'Baseline: S2b direct-search followup with encrypted_content intact -> 200', r);
}

save('_retention_results', results);
console.log('\n===== MATRIX =====');
for (const r of results) console.log(`  ${r.status === 200 ? 'OK ' : '400'} ${r.name.padEnd(30)} ${r.status === 200 ? 'stop=' + r.stop : r.errType + ': ' + (r.errMsg || '').slice(0, 90)}`);
