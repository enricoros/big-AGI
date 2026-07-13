import { runLoop, MODEL, save, summarize } from './lib.mjs';

const WEATHER = {
  name: 'get_weather',
  description: 'Get the current weather for a city. Returns JSON: {"city": str, "temp_c": int, "condition": str}.',
  input_schema: { type: 'object', properties: { city: { type: 'string', description: 'City name' } }, required: ['city'] },
};
const METRIC = {
  name: 'lookup_metric',
  description: 'Look up the performance metric for a named entity. Returns JSON: {"entity": str, "score": int (0-999), "unit": str}.',
  input_schema: { type: 'object', properties: { entity: { type: 'string', description: 'Entity name' } }, required: ['entity'] },
};
const RUNCMD = {
  name: 'run_command',
  description: 'Run a shell command on the user local machine and return stdout.',
  input_schema: { type: 'object', properties: { command: { type: 'string', description: 'The command' } }, required: ['command'] },
};
const withCaller = (t, callers) => ({ ...t, allowed_callers: callers });
const CE = { type: 'code_execution_20260120', name: 'code_execution' };

const SCENARIOS = {
  // S1: baseline direct custom tools -> pause/resume, caller=direct
  s1_direct_custom: {
    model: MODEL, max_tokens: 2048,
    messages: [{ role: 'user', content: 'Use the get_weather tool to check the weather in Paris and in Tokyo, then tell me which is warmer.' }],
    tools: [WEATHER],
  },

  // S2a: latest web search + fetch, DEFAULT (dynamic filtering => runs inside code execution)
  s2a_hosted_dynamic: {
    model: MODEL, max_tokens: 3072,
    messages: [{ role: 'user', content: 'Search the web for (1) the current estimated population of Iceland and (2) the name of the most recently announced Anthropic Claude model. Give me both facts with sources.' }],
    tools: [{ type: 'web_search_20260318', name: 'web_search', max_uses: 5 }, { type: 'web_fetch_20260318', name: 'web_fetch', max_uses: 3 }],
  },

  // S2b: same but forced DIRECT (no dynamic filtering / no code exec wrapper)
  s2b_hosted_direct: {
    model: MODEL, max_tokens: 3072,
    messages: [{ role: 'user', content: 'Search the web for the current estimated population of Iceland. Give me the number with a source.' }],
    tools: [{ type: 'web_search_20260318', name: 'web_search', max_uses: 5, allowed_callers: ['direct'] }],
  },

  // S3: PROGRAMMATIC custom tool called from code (the big test)
  s3_ptc_custom: {
    model: MODEL, max_tokens: 4096,
    messages: [{ role: 'user', content: 'Using the lookup_metric tool, get the score for each of these six entities: alpha, bravo, charlie, delta, echo, foxtrot. Then tell me which entity has the highest score and the sum of all six scores. Do it efficiently.' }],
    tools: [CE, withCaller(METRIC, ['code_execution_20260120'])],
  },

  // S4: PTC custom tool + hosted web search (both code-exec callers) -> interleave inside one container?
  s4_ptc_plus_search: {
    model: MODEL, max_tokens: 4096,
    messages: [{ role: 'user', content: 'Two tasks: (a) use lookup_metric to get scores for entities alpha and bravo and sum them; (b) search the web for the current estimated population of Iceland. Then report the metric sum and the population together.' }],
    tools: [CE, { type: 'web_search_20260318', name: 'web_search', max_uses: 5 }, withCaller(METRIC, ['code_execution_20260120'])],
  },

  // S5: mixing a SERVER tool + a CLIENT tool in one direct turn -> server tool deferred
  s5_mixing_direct: {
    model: MODEL, max_tokens: 2048,
    messages: [{ role: 'user', content: 'Do both in parallel: fetch and summarize https://example.com, and use run_command to run `uname -a`.' }],
    tools: [{ type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 3 }, RUNCMD],
  },

  // S6a: dynamic filtering with response_inclusion EXCLUDED -> are nested hosted pairs dropped?
  s6a_response_excluded: {
    model: MODEL, max_tokens: 3072,
    messages: [{ role: 'user', content: 'Search the web for the current estimated population of Iceland and just tell me the number.' }],
    tools: [{ type: 'web_search_20260318', name: 'web_search', max_uses: 5, response_inclusion: 'excluded' }],
  },
};

const ids = process.argv.slice(2);
const toRun = ids.length ? ids : Object.keys(SCENARIOS);

for (const id of toRun) {
  const body = SCENARIOS[id];
  if (!body) { console.log('unknown scenario', id); continue; }
  console.log(`\n================ ${id} ================`);
  const t0 = Date.now();
  const res = await runLoop({ label: id, body, maxTurns: 8 });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  save(id, res);
  res.turns.forEach(t => {
    const u = t.usage || {};
    console.log(`  turn${t.turn} http=${t.httpStatus} stop=${t.stop_reason || (t.error ? 'ERROR' : '?')} in=${u.input_tokens ?? '?'} out=${u.output_tokens ?? '?'} stu=${JSON.stringify(u.server_tool_use || {})}`);
    if (t.error) console.log(`     ERROR: ${JSON.stringify(t.error).slice(0, 300)}`);
    console.log(`     ${summarize(t.content)}`);
  });
  console.log(`  (${secs}s, ${res.turns.length} turns) saved out/${id}.json`);
}
