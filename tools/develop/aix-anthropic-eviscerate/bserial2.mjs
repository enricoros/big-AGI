import { apiKey, MODEL, save } from './lib.mjs';
async function create(b) { const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': apiKey(), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { status: res.status, body: await res.json() }; }
const CE = { type: 'code_execution_20260120', name: 'code_execution' };
const CHAIN = { A: 'B', B: 'C', C: 'D', D: 'STOP' };
const tool = { name: 'chain_step', description: 'Given {"token": str} returns the next token string; "STOP" ends the chain.', input_schema: { type: 'object', properties: { token: { type: 'string' } }, required: ['token'] }, allowed_callers: ['code_execution_20260120'] };

let messages = [{ role: 'user', content: 'Start with token "A". Write ONE Python cell with a while-loop: repeatedly call chain_step({"token": current}), set current to the returned value, append to a path list, and stop when it returns "STOP". Print the path. The loop must reuse the same cell.' }];
let container;
const log = [];
for (let turn = 0; turn < 8; turn++) {
  const r = await create({ model: MODEL, max_tokens: 2048, tools: [CE, tool], messages, ...(container ? { container } : {}) });
  if (r.status !== 200) { console.log('ERR', JSON.stringify(r.body).slice(0, 200)); break; }
  container = r.body.container?.id || container;
  const content = r.body.content;
  const codeBlk = content.find(b => b.type === 'server_tool_use' && b.name === 'code_execution');
  const calls = content.filter(b => b.type === 'tool_use');
  const codeResult = content.find(b => b.type === 'code_execution_tool_result');
  console.log(`\n--- turn${turn} stop=${r.body.stop_reason} codeId=${codeBlk?.id?.slice(-6) || '-'} calls=[${calls.map(c => c.input.token).join(',')}]`);
  if (codeBlk) console.log('CODE:\n' + (codeBlk.input.code || '').split('\n').map(l => '   ' + l).join('\n'));
  if (codeResult) console.log('RESULT type=' + codeResult.content?.type + ' stdout=' + JSON.stringify(codeResult.content?.stdout || codeResult.content?.encrypted_stdout?.slice(0, 40)));
  log.push({ turn, stop: r.body.stop_reason, codeId: codeBlk?.id, tokens: calls.map(c => c.input.token), code: codeBlk?.input?.code, resultType: codeResult?.content?.type });
  messages = messages.concat([{ role: 'assistant', content }]);
  if (r.body.stop_reason === 'tool_use' && calls.length) {
    messages = messages.concat([{ role: 'user', content: calls.map(c => ({ type: 'tool_result', tool_use_id: c.id, content: CHAIN[c.input.token] ?? 'STOP' })) }]);
  } else break;
}
save('_bserial2', log);
