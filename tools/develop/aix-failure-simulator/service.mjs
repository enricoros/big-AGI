// The simulator's AI service: one port that answers as OpenAI (Chat Completions and Responses), Anthropic and Gemini.
// The model id says what it answers and what goes wrong:    <dialect prefix><scenario>[~<defect>]
//   scenario   a capture's name (tools/data/aix-replay/generations) or a hand-built one (lib/dialects.mjs)
//   defect     what the transport does to the answer (lib/defects.mjs)
// The model lists hold every scenario, so the app offers them as models. CORS is open: Direct Connection works too.
//
//   node tools/develop/aix-failure-simulator/service.mjs [port=8791]
//   GET /__sim                               the scenarios, and the armed defect
//   GET /__sim?defect=cut4[&count=1][&match=claude]   arm a defect for the next request(s) whose model id holds `match`
//   GET /__sim?defect=none                   disarm          GET /__sim?reset   forget the request counts
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CORS, listen, parseJson, readBody, send } from './lib/http.mjs';
import { applyBefore, beforeApplies, DEFECT_KINDS, parseDefect, sendChunks } from './lib/defects.mjs';
import { capturePlan, indexCaptures } from './lib/captures.mjs';
import { DIALECTS, LISTED_DEFECTS } from './lib/dialects.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CORPUS = path.resolve(HERE, '../../data/aix-replay/generations');

/** A run of requests ends after this much silence: the next request for the same model counts from 1 again */
const RUN_GAP_MS = 30_000;

/**
 * Every scenario of every dialect: Map<dialect id, Map<name, { name, vendor?, modes, plan(ctx) }>>.
 * `vendor` is set on a capture; `modes` says which of streaming / non-streaming it can answer.
 */
export function buildCatalog(corpus = CORPUS) {
  const captures = indexCaptures(corpus);
  const capture = (file) => {
    const at = path.join(corpus, file);
    return fs.existsSync(at) ? fs.readFileSync(at, 'utf8') : null;
  };
  const catalog = new Map();
  for (const dialect of DIALECTS) {
    const scenarios = new Map();
    for (const [name, build] of Object.entries(dialect.scenarios)) {
      const plan = (ctx) => build({ ...ctx, capture });
      const modes = { stream: !!plan({ model: dialect.prefix + name, streaming: true, hit: 1 }), whole: !!plan({ model: dialect.prefix + name, streaming: false, hit: 1 }) };
      if (modes.stream || modes.whole) scenarios.set(name, { name, modes, plan });
    }
    for (const vendor of dialect.vendors)
      for (const entry of captures.get(vendor)?.values() ?? [])
        if (!scenarios.has(entry.name))
          scenarios.set(entry.name, { name: entry.name, vendor, modes: { stream: entry.sse.some(Boolean), whole: entry.json.some(Boolean) }, plan: (ctx) => capturePlan(entry, ctx) });
    catalog.set(dialect.id, scenarios);
  }
  return catalog;
}

/** `fast`: no pause between chunks, for a driver; a scenario that is slow on purpose keeps its pace */
export async function startService({ port = 8791, corpus = CORPUS, fast = false, log = console.log } = {}) {
  const catalog = buildCatalog(corpus);
  const runs = new Map(); // key -> { n, at }
  let armed = null;       // { defect, left, match }

  /** The count of this request within its run, from 1 */
  function hitOf(key) {
    const now = Date.now(), run = runs.get(key);
    const n = run && now - run.at < RUN_GAP_MS ? run.n + 1 : 1;
    runs.set(key, { n, at: now });
    return n;
  }

  function takeArmed(model) {
    if (!armed || !model.includes(armed.match)) return undefined;
    const { defect } = armed;
    if (--armed.left <= 0) armed = null;
    return defect;
  }

  /** What a service's model list holds: its hand-built scenarios, its own vendor's captures, and the listed defects of `ok` */
  function listed(dialect) {
    const scenarios = catalog.get(dialect.id);
    const models = [...scenarios.values()].filter(s => !s.vendor || s.vendor === dialect.own).map(s => [dialect.prefix + s.name, `Sim: ${s.name}`]);
    if (scenarios.has('ok'))
      for (const defect of LISTED_DEFECTS) models.push([`${dialect.prefix}ok~${defect}`, `Sim: ok ~ ${defect}`]);
    return models.map(([id, title]) => dialect.model(id, title));
  }

  function control(url, res) {
    if (url.searchParams.has('reset')) runs.clear();
    const spec = url.searchParams.get('defect');
    if (spec === 'none') armed = null;
    else if (spec !== null) {
      try {
        armed = { defect: parseDefect(spec), left: Number(url.searchParams.get('count') || 1), match: url.searchParams.get('match') || '' };
      } catch (error) {
        return send(res, 400, { error: error.message });
      }
      log(`[service] armed ${armed.defect.spec} x${armed.left}${armed.match ? ` for '${armed.match}'` : ''}`);
    }
    return send(res, 200, {
      armed: armed && { defect: armed.defect.spec, left: armed.left, match: armed.match },
      defects: DEFECT_KINDS,
      dialects: Object.fromEntries(DIALECTS.map(d => [d.id, { service: d.service, prefix: d.prefix, scenarios: [...catalog.get(d.id).values()].map(s => ({ name: s.name, ...(s.vendor && { vendor: s.vendor }), ...s.modes })) }])),
    });
  }

  async function generate(req, res, dialect, { model, streaming }) {
    const [id, suffix] = model.split('~');
    const scenario = id.startsWith(dialect.prefix) ? catalog.get(dialect.id).get(id.slice(dialect.prefix.length)) : undefined;
    if (!scenario) {
      log(`[service] ${dialect.id} ${model}: no such scenario`);
      const { body, headers } = dialect.error(404, model);
      return send(res, 404, body, headers);
    }

    let defect;
    try {
      defect = suffix ? parseDefect(suffix) : takeArmed(model);
    } catch (error) {
      return send(res, 400, { error: { message: `aix-failure-simulator: ${error.message}` } });
    }

    const run = `${model} ${streaming ? 'stream' : 'whole'}`; // the two modes of one model are separate runs
    const hit = hitOf(run);
    log(`[service] ${dialect.id} ${model} ${streaming ? 'stream' : 'whole'} hit=${hit}${defect ? ` defect=${defect.spec}` : ''}`);
    if (beforeApplies(defect, hit))
      return applyBefore(req, res, defect.before, (status) => dialect.error(status, model));

    // the scenario counts the requests that reach it: a paused turn's part 1 is still part 1 after a refused attempt
    const plan = scenario.plan({ model, streaming, hit: hitOf(run + ' answered') });
    if (!plan)
      return send(res, 400, { error: { message: `aix-failure-simulator: '${scenario.name}' has no ${streaming ? 'streaming' : 'non-streaming'} answer` } });
    res.writeHead(200, { 'content-type': plan.stream ? 'text/event-stream' : 'application/json', 'cache-control': 'no-cache', ...CORS });
    return sendChunks(req, res, plan.chunks, { pace: fast && !plan.slow ? 0 : plan.pace, defect, hang: plan.hang });
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
      const url = new URL(req.url, 'http://simulator');
      if (url.pathname === '/__sim') return control(url, res);

      // one list per service: OpenAI's holds both of its dialects
      const listing = DIALECTS.filter(dialect => dialect.lists(req, url));
      if (listing.length) return send(res, 200, listing[0].list(listing.flatMap(listed)));

      const body = req.method === 'POST' ? parseJson(await readBody(req)) : {};
      for (const dialect of DIALECTS) {
        const call = dialect.generation(req, url, body);
        if (call) return await generate(req, res, dialect, call);
      }
      log(`[service] no route: ${req.method} ${url.pathname}`);
      send(res, 404, { error: { message: `aix-failure-simulator: no route for ${req.method} ${url.pathname}` } });
    } catch (error) {
      log('[service] handler error:', error?.message);
      try { res.destroy(); } catch { /* gone already */ }
    }
  });

  const listening = await listen(server, port, '127.0.0.1');
  return { port: listening, url: `http://127.0.0.1:${listening}`, catalog, close: () => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); }) };
}

// no top-level await: the driver loads this file through tsx, which compiles it to CommonJS
if (import.meta.url === `file://${process.argv[1]}`)
  startService({ port: Number(process.argv[2] || 8791) }).then(service => {
    console.log(`[service] ${service.url}   control: ${service.url}/__sim`);
    for (const dialect of DIALECTS) {
      const scenarios = [...service.catalog.get(dialect.id).values()];
      console.log(`  ${dialect.id.padEnd(17)} ${dialect.prefix}<scenario>   ${scenarios.filter(s => !s.vendor).length} hand-built, ${scenarios.filter(s => s.vendor).length} captures`);
    }
    console.log(`  in the app: add the OpenAI, Anthropic and Gemini services with the API host ${service.url}, then any key (the host first)`);
  });
