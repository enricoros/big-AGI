import { apiKey, MODEL, save } from './lib.mjs';
async function callJson(body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': apiKey(), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let json; try { json = await res.json(); } catch { json = { parseError: true }; }
  return { status: res.status, body: json };
}
const METRIC = { name: 'lookup_metric', description: 'Look up the metric for an entity. Returns JSON {"entity","score","unit"}.', input_schema: { type: 'object', properties: { entity: { type: 'string' } }, required: ['entity'] }, allowed_callers: ['code_execution_20260120'] };
const CE = { type: 'code_execution_20260120', name: 'code_execution' };
const prompt = 'Use lookup_metric to get scores for alpha, bravo, charlie and tell me the max. Do it in code.';

// 1) fresh request -> expect pause (PTC)
const t0 = await callJson({ model: MODEL, max_tokens: 2048, messages: [{ role: 'user', content: prompt }], tools: [CE, METRIC] });
const container = t0.body.container?.id;
const calls = (t0.body.content || []).filter(b => b.type === 'tool_use');
console.log('turn0:', t0.status, 'stop=' + t0.body.stop_reason, 'container=' + (container ? 'yes' : 'no'), 'ptc_calls=' + calls.length);
const toolResults = calls.map(b => ({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify({ entity: b.input.entity, score: 42, unit: 'points' }) }));
const base = [{ role: 'user', content: prompt }, { role: 'assistant', content: t0.body.content }, { role: 'user', content: toolResults }];

// 2) resume WITHOUT the code_execution tool (docs claim this should 400)
const noCE = await callJson({ model: MODEL, max_tokens: 1024, messages: base, tools: [METRIC], container });
console.log('\nresume WITHOUT code_execution tool:', noCE.status, noCE.status === 200 ? 'stop=' + noCE.body.stop_reason : noCE.body.error?.type + ' :: ' + (noCE.body.error?.message || '').slice(0, 200));

// 3) resume WITHOUT container id (docs: rejects continuation w/ pending PTC and no container)
const noCid = await callJson({ model: MODEL, max_tokens: 1024, messages: base, tools: [CE, METRIC] });
console.log('resume WITHOUT container id:      ', noCid.status, noCid.status === 200 ? 'stop=' + noCid.body.stop_reason : noCid.body.error?.type + ' :: ' + (noCid.body.error?.message || '').slice(0, 200));

// 4) control: resume WITH everything
const full = await callJson({ model: MODEL, max_tokens: 1024, messages: base, tools: [CE, METRIC], container });
console.log('resume WITH ce tool + container:  ', full.status, full.status === 200 ? 'stop=' + full.body.stop_reason : full.body.error?.type + ' :: ' + (full.body.error?.message || '').slice(0, 200));

save('_r3clean', { turn0: { status: t0.status, stop: t0.body.stop_reason, container, ptc_calls: calls.length }, noCE: { status: noCE.status, stop: noCE.body.stop_reason, err: noCE.body.error }, noCid: { status: noCid.status, err: noCid.body.error }, full: { status: full.status, stop: full.body.stop_reason } });
