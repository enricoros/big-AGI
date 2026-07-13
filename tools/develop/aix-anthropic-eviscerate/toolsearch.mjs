import { MODEL, save, runLoop, summarize, runClientTool } from './lib.mjs';

// a catalog of deferred tools to force a search
const deferred = [
  { name: 'get_weather', description: 'Get the current weather for a city.', input_schema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] }, defer_loading: true },
  { name: 'send_email', description: 'Send an email to a recipient.', input_schema: { type: 'object', properties: { to: { type: 'string' }, body: { type: 'string' } }, required: ['to'] }, defer_loading: true },
  { name: 'create_calendar_event', description: 'Create a calendar event.', input_schema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] }, defer_loading: true },
  { name: 'query_stock_price', description: 'Get a stock price by ticker.', input_schema: { type: 'object', properties: { ticker: { type: 'string' } }, required: ['ticker'] }, defer_loading: true },
];
const CE = { type: 'code_execution_20260120', name: 'code_execution' };
const METRIC_DEFERRED_CE = { name: 'lookup_metric', description: 'Look up the performance metric for an entity. Returns JSON {"entity","score","unit"}.', input_schema: { type: 'object', properties: { entity: { type: 'string' } }, required: ['entity'] }, defer_loading: true, allowed_callers: ['code_execution_20260120'] };

function report(label, res) {
  console.log(`\n===== ${label} =====`);
  res.turns.forEach(t => console.log(`  turn${t.turn} http=${t.httpStatus} stop=${t.stop_reason || (t.error && 'ERR')} ${t.error ? JSON.stringify(t.error).slice(0, 140) : ''}\n     ${summarize(t.content)}`));
  // did discovered tool get called direct or from code?
  const discoveredCalls = res.turns.flatMap(t => (t.content || []).filter(b => b.type === 'tool_use')).map(b => ({ name: b.name, caller: b.caller?.type }));
  const searches = res.turns.flatMap(t => (t.content || []).filter(b => b.type === 'server_tool_use' && b.name?.startsWith('tool_search'))).map(b => b.input);
  console.log('   searches:', JSON.stringify(searches), '| discovered-tool calls:', JSON.stringify(discoveredCalls));
  return { discoveredCalls, searches };
}

// TS1: regex tool-search, plain discovered tool called directly
const ts1 = await runLoop({ label: 'ts1_regex', maxTurns: 6, resolve: runClientTool,
  body: { model: MODEL, max_tokens: 1024, tools: [{ type: 'tool_search_tool_regex_20251119', name: 'tool_search_tool_regex' }, ...deferred], messages: [{ role: 'user', content: 'What is the weather in Denver? Use a tool.' }] } });
const r1 = report('TS1 regex search -> direct call', ts1);

// TS2: bm25 tool-search + code execution; discovered tool is code-exec-callable (PTC). Does search->code compose?
const ts2 = await runLoop({ label: 'ts2_bm25_ptc', maxTurns: 8, resolve: runClientTool,
  body: { model: MODEL, max_tokens: 3072, tools: [{ type: 'tool_search_tool_bm25_20251119', name: 'tool_search_tool_bm25' }, CE, METRIC_DEFERRED_CE, ...deferred], messages: [{ role: 'user', content: 'Efficiently look up the performance metric score for entities alpha, bravo, charlie, delta and tell me the highest. Find the right tool first, then use it.' }] } });
const r2 = report('TS2 bm25 search + PTC (does discovered tool get called from code?)', ts2);

save('_toolsearch', { ts1: r1, ts2: r2 });
