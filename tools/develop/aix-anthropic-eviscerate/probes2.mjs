import fs from 'node:fs';
import path from 'node:path';
import { OUT, apiKey, MODEL, save, runLoop, summarize } from './lib.mjs';
const load = id => JSON.parse(fs.readFileSync(path.join(OUT, `${id}.json`), 'utf8'));
async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'x-api-key': apiKey(), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let j; try { j = await res.json(); } catch { j = {}; }
  return { status: res.status, body: j };
}
const create = b => post('https://api.anthropic.com/v1/messages', b);
const CE = { type: 'code_execution_20260120', name: 'code_execution' };

// ---------- why does count_tokens fail on server-tool histories? ----------
{
  const d = load('s3_ptc_custom');
  const ct = await post('https://api.anthropic.com/v1/messages/count_tokens', { model: MODEL, messages: d.finalMessages, tools: [CE, { name: 'lookup_metric', description: 'x', input_schema: { type: 'object', properties: { entity: { type: 'string' } } }, allowed_callers: ['code_execution_20260120'] }] });
  console.log('COUNT_TOKENS on PTC history:', ct.status, JSON.stringify(ct.body?.error?.message || ct.body).slice(0, 200));
}

// ---------- B: multi-round SERIAL PTC (does one code cell pause repeatedly?) ----------
console.log('\n===== B: serial PTC chain =====');
{
  const CHAIN = { A: 'B', B: 'C', C: 'D', D: 'STOP' };
  const chainTool = { name: 'chain_step', description: 'Given {"token": str}, returns the next token as a plain string. Returns "STOP" when the chain ends.', input_schema: { type: 'object', properties: { token: { type: 'string' } }, required: ['token'] }, allowed_callers: ['code_execution_20260120'] };
  const body = { model: MODEL, max_tokens: 3072, tools: [CE, chainTool],
    messages: [{ role: 'user', content: 'Start with token "A". In ONE code block, loop: call chain_step with the current token, set current to its return value, and repeat until it returns "STOP". Collect the full path and print it. Do NOT unroll manually - use a while loop so each step depends on the previous result.' }] };
  const res = await runLoop({ label: 'bserial', body, maxTurns: 10, resolve: (n, i) => CHAIN[i.token] ?? 'STOP' });
  const codeIds = new Set(), pauses = [];
  res.turns.forEach(t => { const cs = (t.content || []).filter(b => b.type === 'tool_use'); if (t.stop_reason === 'tool_use') pauses.push(cs.map(b => b.input.token).join(',')); (t.content || []).forEach(b => { if (b.type === 'tool_use' && b.caller?.tool_id) codeIds.add(b.caller.tool_id); }); });
  console.log('pause-rounds:', pauses.length, '| tokens per pause:', JSON.stringify(pauses), '| distinct code_execution tool_ids across pauses:', codeIds.size);
  save('_bserial', { pauses, distinctCodeIds: codeIds.size, turns: res.turns.map(t => ({ stop: t.stop_reason, seq: summarize(t.content) })) });
}

// ---------- constraint 400s + PTC robustness ----------
console.log('\n===== constraints & robustness =====');
const METRIC_CE = { name: 'lookup_metric', description: 'Look up metric. Returns JSON {"entity","score"}.', input_schema: { type: 'object', properties: { entity: { type: 'string' } }, required: ['entity'] }, allowed_callers: ['code_execution_20260120'] };
const out = [];
const rec = (name, r, note) => { out.push({ name, status: r.status, err: r.body?.error?.message?.slice(0, 140), note }); console.log(`  ${r.status === 200 ? 'OK ' : r.status} ${name.padEnd(34)} ${r.status === 200 ? (note || '') : r.body?.error?.message?.slice(0, 120)}`); };

// tool_choice forcing a code-exec-only tool
rec('tool_choice=code_only_tool', await create({ model: MODEL, max_tokens: 512, tools: [CE, METRIC_CE], tool_choice: { type: 'tool', name: 'lookup_metric' }, messages: [{ role: 'user', content: 'get metric for alpha' }] }));
// disable_parallel_tool_use + PTC
rec('disable_parallel+PTC', await create({ model: MODEL, max_tokens: 512, tools: [CE, METRIC_CE], disable_parallel_tool_use: true, messages: [{ role: 'user', content: 'get metrics for alpha, bravo, charlie in code' }] }), '(may be ignored or 400)');
// recursive $ref tool marked code-exec
const recur = { name: 'tree', description: 'recursive', input_schema: { type: 'object', properties: { node: { $ref: '#' } } }, allowed_callers: ['code_execution_20260120'] };
rec('recursive_$ref+code_exec', await create({ model: MODEL, max_tokens: 256, tools: [CE, recur], messages: [{ role: 'user', content: 'hi' }] }));
// strict:true + programmatic
rec('strict_true+code_exec', await create({ model: MODEL, max_tokens: 256, tools: [CE, { ...METRIC_CE, strict: true }], messages: [{ role: 'user', content: 'hi' }] }));

// PTC robustness: fresh pause, then (a) omit a result, (b) non-text (image) result
{
  const t0 = await create({ model: MODEL, max_tokens: 1024, tools: [CE, METRIC_CE], messages: [{ role: 'user', content: 'get metrics for alpha, bravo, charlie in one code block' }] });
  const container = t0.body.container?.id;
  const calls = (t0.body.content || []).filter(b => b.type === 'tool_use');
  const base = [{ role: 'user', content: 'get metrics for alpha, bravo, charlie in one code block' }, { role: 'assistant', content: t0.body.content }];
  console.log(`  (fresh pause: ${calls.length} calls, stop=${t0.body.stop_reason})`);
  if (calls.length >= 2) {
    // (a) omit one result
    const partial = calls.slice(0, -1).map(b => ({ type: 'tool_result', tool_use_id: b.id, content: '{"entity":"x","score":1}' }));
    rec('PTC_omit_one_result', await create({ model: MODEL, max_tokens: 512, tools: [CE, METRIC_CE], container, messages: [...base, { role: 'user', content: partial }] }), '(returned <N results)');
    // (b) image content in a PTC tool_result
    const withImg = calls.map((b, idx) => ({ type: 'tool_result', tool_use_id: b.id, content: idx === 0 ? [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' } }] : '{"entity":"x","score":1}' }));
    rec('PTC_image_result', await create({ model: MODEL, max_tokens: 512, tools: [CE, METRIC_CE], container, messages: [...base, { role: 'user', content: withImg }] }), '(image in PTC result)');
  }
}
save('_probes2', out);
