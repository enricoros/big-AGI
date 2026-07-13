// Token-accounting ablation harness. For a completed transcript, mutate history and measure:
//  - count_tokens (free, structural)  vs  real-inference usage.input_tokens (authoritative context cost)
//  - HTTP legality (400 = mandatory to keep)   - answer text (info survival)
import fs from 'node:fs';
import path from 'node:path';
import { OUT, apiKey, MODEL, save } from './lib.mjs';
const load = id => JSON.parse(fs.readFileSync(path.join(OUT, `${id}.json`), 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'x-api-key': apiKey(), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let j; try { j = await res.json(); } catch { j = {}; }
  return { status: res.status, body: j };
}
const countTokens = body => post('https://api.anthropic.com/v1/messages/count_tokens', body);
const create = body => post('https://api.anthropic.com/v1/messages', body);

// tools per base (must match original request so replay is valid)
const CE = { type: 'code_execution_20260120', name: 'code_execution' };
const METRIC = { name: 'lookup_metric', description: 'Look up the metric for an entity. Returns JSON {"entity","score","unit"}.', input_schema: { type: 'object', properties: { entity: { type: 'string' } }, required: ['entity'] }, allowed_callers: ['code_execution_20260120'] };
const WS_DYN = { type: 'web_search_20260318', name: 'web_search', max_uses: 5 };
const WF_DYN = { type: 'web_fetch_20260318', name: 'web_fetch', max_uses: 3 };
const WS_DIR = { type: 'web_search_20260318', name: 'web_search', max_uses: 5, allowed_callers: ['direct'] };

// ---- ablation primitives (operate on assistant content within a messages clone) ----
const asstMsgs = m => m.filter(x => x.role === 'assistant');
function dropFromAssistants(m, pred) { for (const a of asstMsgs(m)) a.content = a.content.filter(b => !pred(b)); }
function dropUserToolResults(m) { return m.filter(x => !(x.role === 'user' && Array.isArray(x.content) && x.content.every(b => b.type === 'tool_result'))); }

const isNestedPtc = b => b.type === 'tool_use' && b.caller && b.caller.type !== 'direct';
const isNestedHosted = b => (b.type === 'server_tool_use' && (b.name === 'web_search' || b.name === 'web_fetch') && b.caller && b.caller.type !== 'direct') || (['web_search_tool_result', 'web_fetch_tool_result'].includes(b.type) && b.caller && b.caller.type !== 'direct');
const isCodeCall = b => b.type === 'server_tool_use' && b.name === 'code_execution';
const isCodeResult = b => b.type === 'code_execution_tool_result';
const isDirectHosted = b => (b.type === 'server_tool_use' && b.name === 'web_search') || b.type === 'web_search_tool_result';

const BASES = {
  s3_ptc_custom: { tools: [CE, METRIC], cont: 'In one word, which entity had the highest score?',
    ablations: {
      full: m => m,
      strip_nested_ptc: m => { let x = dropUserToolResults(m); dropFromAssistants(x, isNestedPtc); return x; },
      strip_code_text: m => { for (const a of asstMsgs(m)) for (const b of a.content) if (isCodeCall(b)) b.input = { code: '' }; return m; },
      strip_code_result_keep_call: m => { dropFromAssistants(m, isCodeResult); return m; },
      strip_code_pair: m => { let x = dropUserToolResults(m); dropFromAssistants(x, b => isNestedPtc(b) || isCodeCall(b) || isCodeResult(b)); return x; },
      text_only: m => { for (const a of asstMsgs(m)) a.content = a.content.filter(b => b.type === 'text'); return dropUserToolResults(m); },
    } },
  s2a_hosted_dynamic: { tools: [WS_DYN, WF_DYN], cont: 'In one line, what Iceland population did you find?',
    ablations: {
      full: m => m,
      strip_nested_hosted: m => { dropFromAssistants(m, isNestedHosted); return m; },
      strip_code_results: m => { dropFromAssistants(m, isCodeResult); return m; }, // keep code calls (dangling) -> ref integrity?
      strip_all_code_and_nested: m => { dropFromAssistants(m, b => isNestedHosted(b) || isCodeCall(b) || isCodeResult(b)); return m; },
      text_only: m => { for (const a of asstMsgs(m)) a.content = a.content.filter(b => b.type === 'text'); return m; },
    } },
  s2b_hosted_direct: { tools: [WS_DIR], cont: 'In one line, what is the population number?',
    ablations: {
      full: m => m,
      drop_encrypted_content: m => { for (const a of asstMsgs(m)) for (const b of a.content) if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const r of b.content) delete r.encrypted_content; return m; },
      drop_direct_pair: m => { dropFromAssistants(m, isDirectHosted); return m; },
      text_only: m => { for (const a of asstMsgs(m)) a.content = a.content.filter(b => b.type === 'text'); return m; },
    } },
};

const rows = [];
for (const [baseId, cfg] of Object.entries(BASES)) {
  const d = load(baseId);
  const container = d.turns.find(t => t.container)?.container?.id;
  for (const [ablName, fn] of Object.entries(cfg.ablations)) {
    const base = clone(d.finalMessages);
    const mutated = fn(base);
    const msgs = mutated.concat([{ role: 'user', content: cfg.cont }]);
    const reqBase = { model: MODEL, messages: msgs, tools: cfg.tools, ...(container ? { container } : {}) };
    const ct = await countTokens({ model: MODEL, messages: msgs, tools: cfg.tools });
    const inf = await create({ ...reqBase, max_tokens: 40 });
    const answer = (inf.body?.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ').replace(/\s+/g, ' ').trim().slice(0, 70);
    const row = {
      base: baseId, ablation: ablName,
      count_tokens: ct.status === 200 ? ct.body.input_tokens : `ERR:${ct.body?.error?.type}`,
      infer_input: inf.status === 200 ? inf.body.usage?.input_tokens : null,
      http: inf.status, stop: inf.body?.stop_reason, err: inf.status !== 200 ? (inf.body?.error?.message || '').slice(0, 90) : '',
      answer: inf.status === 200 ? answer : '',
    };
    rows.push(row);
    console.log(`${baseId} · ${ablName.padEnd(28)} ct=${String(row.count_tokens).padStart(6)} inf=${String(row.infer_input ?? '-').padStart(6)} http=${row.http} ${row.err || '“' + row.answer + '”'}`);
  }
  console.log('');
}
save('_tokacct', rows);
