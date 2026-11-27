// The simulator's driver: scenarios through the real code, one row each; rows are data, to read, save and compare.
//
//   chain layer (default)   real dispatch creation, executor (continuation, retriers, demuxer, parser, transmitter) and
//                           real ContentReassembler, over HTTP to the simulator's service: all but the relay hop and a browser
//   relay layer (--relay)   the app's real tRPC stream client -> the simulator's relay -> a running app server -> the service
//
//   npx tsx tools/develop/aix-failure-simulator/run.ts [words ...]                              from the repo root
//     words              only the cases whose id holds one of them (default: every case)
//     --list             the cases, not run
//     --models           what the app's own model listing makes of the service's lists
//     --json <file>      write the rows
//     --compare <a> <b>  the rows that differ between two files, and nothing else
//     --relay <url>      the relay layer: the URL of a running relay.mjs (its app server needs the service reachable)
//     --service <url>    a running service.mjs, instead of one started here on a free port
//     --verbose          each row with its issues' texts and its fragments
//   env TREE=<path>      run another checkout's code against this simulator: TREE=<path> npx tsx --tsconfig <path>/tsconfig.json ...
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DIALECTS, LISTED_DEFECTS } from './lib/dialects.mjs';
import { listen } from './lib/http.mjs';
import { startService } from './service.mjs';

(process.env as Record<string, string | undefined>).NODE_ENV ??= 'development'; // the app's types make it read-only
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TREE = process.env.TREE || path.resolve(HERE, '../../..');


/** A port nothing listens on: taken, then given back */
async function closedPort(): Promise<number> {
  const probe = http.createServer();
  const port: number = await listen(probe, 0, '127.0.0.1');
  await new Promise(resolve => probe.close(resolve));
  return port;
}

async function main(): Promise<void> {

  // --- arguments ---

  const argv = process.argv.slice(2);
  const flag = (name: string) => { const at = argv.indexOf(name); return at < 0 ? false : (argv.splice(at, 1), true); };
  const option = (name: string, count = 1) => { const at = argv.indexOf(name); return at < 0 ? undefined : argv.splice(at, count + 1).slice(1); };
  const compare = option('--compare', 2);
  const jsonOut = option('--json')?.[0];
  const relayUrl = option('--relay')?.[0];
  const serviceUrl = option('--service')?.[0];
  const onlyList = flag('--list'), onlyModels = flag('--models'), verbose = flag('--verbose');
  const words = argv;

  // the app's tRPC client, in Node, reads its server's port from PORT when it loads: set before any app code is imported
  if (relayUrl) process.env.PORT = new URL(relayUrl).port;

  type Issue = { code: string, effect: string, causeCode?: string, httpStatus?: number, text?: string };
  type Row = { id: string, outcome: string, stop: string, end: string, issues: Issue[], fragments: string, retries: number, continuations: number, text: string, ms: number, thrown?: string };

  /** What a row says, without what varies between two runs of the same code */
  const stable = ({ ms, ...row }: Row) => JSON.stringify(row);

  if (compare) {
    const [a, b] = compare.map(file => new Map((JSON.parse(fs.readFileSync(file, 'utf8')) as Row[]).map(row => [row.id, row])));
    let differences = 0;
    for (const id of new Set([...a.keys(), ...b.keys()])) {
      const before = a.get(id), after = b.get(id);
      if (before && after && stable(before) === stable(after)) continue;
      differences++;
      console.log(`\n${id}`);
      console.log(`  ${compare[0]}: ${before ? line(before) : '(no row)'}`);
      console.log(`  ${compare[1]}: ${after ? line(after) : '(no row)'}`);
    }
    console.log(`\n${differences} of ${new Set([...a.keys(), ...b.keys()]).size} rows differ`);
    process.exit(differences ? 1 : 0);
  }


  // --- the service, and how each vendor's own dialect reaches it ---

  const log = console.log;
  const service = serviceUrl ? { url: serviceUrl.replace(/\/$/, ''), close: async () => undefined } : await startService({ port: 0, fast: true, log: () => undefined });

  /** The access of each capture folder's vendor: its captures run through its own dialect, as in the app */
  const ACCESS: Record<string, (url: string) => any> = {
    openai: url => ({ dialect: 'openai', oaiKey: 'sk-sim', oaiOrg: '', oaiHost: url }),
    openrouter: url => ({ dialect: 'openrouter', oaiKey: 'sk-or-sim', oaiOrg: '', oaiHost: url }),
    sakanaai: url => ({ dialect: 'sakanaai', oaiKey: 'sk-sim', oaiOrg: '', oaiHost: url }),
    anthropic: url => ({ dialect: 'anthropic', anthropicKey: 'sk-sim', anthropicHost: url }),
    deepseek: url => ({ dialect: 'deepseek', oaiKey: 'sk-sim', oaiOrg: '', oaiHost: url, dsProtocol: 'messages' }),
    gemini: url => ({ dialect: 'gemini', geminiKey: 'sim-key', geminiHost: url, minSafetyLevel: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED' }),
    // xai: its service takes no API host, so its captures are replayed by chatGenerate.replay.test.ts only
  };

  type Case = { id: string, vendor: string, model: any, streaming: boolean, stopAfterMs?: number, host?: string };

  const state: any = await (await fetch(`${service.url}/__sim`)).json();
  const cases: Case[] = [];
  const unreachable: string[] = [];
  for (const dialect of DIALECTS) {
    const modelOf = (id: string) => ({
      id: dialect.id === 'gemini' ? `models/${id}` : id, acceptsOutputs: ['text'], maxTokens: 1024, temperature: 0.5,
      ...(dialect.id === 'openai-responses' && { vndOaiResponsesAPI: true }),
    });
    const add = (vendor: string, name: string, streaming: boolean, extra: Partial<Case> = {}) =>
      cases.push({ id: `${vendor}/${dialect.prefix}${name}${streaming ? '' : ' [whole]'}`, vendor, model: modelOf(dialect.prefix + name), streaming, ...extra });

    for (const scenario of state.dialects[dialect.id].scenarios) {
      const vendor = scenario.vendor ?? dialect.own;
      if (!ACCESS[vendor]) { unreachable.push(`${vendor}/${scenario.name}`); continue; }
      if (scenario.stream) add(vendor, scenario.name, true, scenario.name === 'slow' ? { stopAfterMs: 1500 } : {}); // 'slow' is for a Stop
      if (scenario.whole) add(vendor, scenario.name, false);
    }
    if (state.dialects[dialect.id].scenarios.some((s: any) => s.name === 'ok'))
      for (const defect of [...LISTED_DEFECTS, 'stall4']) // a stall is not listed for the app (it hangs), and ends here with a Stop
        add(dialect.own, `ok~${defect}`, true, defect.startsWith('stall') ? { stopAfterMs: 1500 } : {});
  }
  // what needs no service: a host with nothing listening, and a host the dispatch refuses to use
  cases.push({ id: 'settings/closed-port', vendor: 'openai', model: { id: 'sim-ok', acceptsOutputs: ['text'] }, streaming: true, host: `http://127.0.0.1:${await closedPort()}` });
  cases.push({ id: 'settings/bad-gateway-host', vendor: 'openai', model: { id: 'sim-ok', acceptsOutputs: ['text'] }, streaming: true, host: 'https://gateway.ai.cloudflare.com/x' });
  const selected = cases.filter(c => !words.length || words.some(word => c.id.includes(word)));

  if (onlyList) {
    for (const c of selected) log(c.id);
    log(`\n${selected.length} cases${unreachable.length ? `; ${unreachable.length} captures have no dialect to reach them here (${[...new Set(unreachable.map(u => u.split('/')[0]))].join(', ')})` : ''}`);
    await service.close();
    process.exit(0);
  }


  // --- the real code ---

  const { createChatGenerateDispatch } = await import(`${TREE}/src/modules/aix/server/dispatch/chatGenerate/chatGenerate.dispatch`);
  const { executeChatGenerateWithContinuation } = await import(`${TREE}/src/modules/aix/server/dispatch/chatGenerate/chatGenerate.continuation`);
  const { ContentReassembler } = await import(`${TREE}/src/modules/aix/client/ContentReassembler`);

  if (onlyModels) {
    const { listModelsRunDispatch } = await import(`${TREE}/src/modules/llms/server/listModels.dispatch`);
    const quiet = silence();
    const lines: string[] = [];
    for (const [vendor, headers, idsOf] of [
      ['openai', {}, (list: any) => list.data.map((m: any) => m.id)],
      ['anthropic', { 'anthropic-version': '2023-06-01' }, (list: any) => list.data.map((m: any) => m.id)],
      ['gemini', {}, (list: any) => list.models.map((m: any) => m.name)],
    ] as const) {
      const served: string[] = idsOf(await (await fetch(`${service.url}${vendor === 'gemini' ? '/v1beta/models' : '/v1/models'}`, { headers })).json());
      const { models } = await listModelsRunDispatch(ACCESS[vendor](service.url));
      const listed = new Map<string, any>(models.map((m: any) => [m.id, m]));
      const missing = served.filter(id => !listed.has(id)), hidden = served.filter(id => listed.get(id)?.hidden);
      lines.push(`${vendor.padEnd(10)} the service lists ${served.length}, the app keeps ${served.length - missing.length} (${hidden.length} hidden)${missing.length ? `\n  dropped by the app: ${missing.join(', ')}` : ''}${hidden.length ? `\n  hidden: ${hidden.join(', ')}` : ''}`);
      if (vendor === 'openai') {
        const wrong = served.filter(id => listed.has(id) && id.startsWith('gpt-5-sim-') !== !!listed.get(id).interfaces?.includes('oai-responses'));
        lines.push(`           Responses API by id: ${wrong.length ? `WRONG for ${wrong.join(', ')}` : 'gpt-5-sim-* on Responses, sim-* on Chat Completions'}`);
      }
    }
    quiet.restore();
    log(lines.join('\n'));
    await service.close();
    process.exit(0);
  }


  // --- running ---

  function silence() {
    const { log, warn, error, info } = console;
    console.log = console.warn = console.error = console.info = () => undefined;
    return { restore: () => Object.assign(console, { log, warn, error, info }) };
  }

  function rowOf(id: string, started: number, particles: any[], final: any, thrown?: string): Row {
    const issues: Issue[] = final.fragments
      .filter((f: any) => f.ft === 'content' && f.part.pt === 'aix.issue')
      .map(({ part: { issue } }: any) => ({ code: issue.code, effect: issue.effect, ...(issue.causeCode && { causeCode: issue.causeCode }), ...(issue.httpStatus && { httpStatus: issue.httpStatus }), ...(issue.text && { text: issue.text }) }));
    const kinds: string[] = final.fragments.map((f: any) => f.ft === 'content' ? (f.part.pt === 'aix.issue' ? `issue(${f.part.issue.code}:${f.part.issue.effect})` : f.part.pt) : `void:${f.part.pt}${f.part.pType ? '/' + f.part.pType : ''}`);
    const runs = kinds.reduce<[string, number][]>((acc, kind) => (acc.at(-1)?.[0] === kind ? acc.at(-1)![1]++ : acc.push([kind, 1]), acc), []);
    const text: string = final.fragments.filter((f: any) => f.ft === 'content' && f.part.pt === 'text').map((f: any) => f.part.text).join('|');
    return {
      id,
      outcome: final.outcome,
      stop: final.generator.tokenStopReason ?? '-',
      end: particles.filter(p => p.cg === 'end').map(p => `${p.terminationReason}/${p.tokenStopReason ?? '-'}`)[0] ?? 'no end',
      issues,
      fragments: runs.map(([kind, n]) => n > 1 ? `${kind} x${n}` : kind).join(', '),
      retries: particles.filter(p => p.cg === 'aix-retry-reset' && p.phase === 'waiting').length,
      continuations: particles.filter(p => p.cg === 'aix-info' && p.ait === 'flow-cont').length,
      text: text.length > 70 ? `${text.slice(0, 50)} ... (${text.length} chars)` : text,
      ms: Date.now() - started,
      ...(thrown && { thrown }),
    };
  }

  function line(row: Row): string {
    const issues = row.issues.map(i => `${i.code}:${i.effect}${i.httpStatus || i.causeCode ? `(${[i.httpStatus, i.causeCode].filter(Boolean).join(' ')})` : ''}`).join(' ') || '-';
    return `${row.outcome.padEnd(9)} ${issues}  [${row.end}]${row.retries ? ` retries=${row.retries}` : ''}${row.continuations ? ` continuations=${row.continuations}` : ''}${row.thrown ? ` THROWN ${row.thrown}` : ''}`;
  }

  async function runChain(c: Case): Promise<Row> {
    const access = ACCESS[c.vendor](c.host ?? service.url);
    const chatGenerate = { systemMessage: null, chatSequence: [{ role: 'user', parts: [{ pt: 'text', text: 'hi' }] }] };
    const _d = { runtime: 'relay', prettyDialect: access.dialect, echoRequest: false, requestBodyOverride: undefined, consoleLogErrors: false, profiler: undefined, wire: undefined };
    const stop = new AbortController();
    const timer = c.stopAfterMs ? setTimeout(() => stop.abort(), c.stopAfterMs) : undefined;
    const reassembler = new ContentReassembler({ mgt: 'aix', name: c.model.id, aix: { vId: access.dialect, mId: c.model.id } }, undefined, undefined, [], true, undefined, undefined, stop.signal);
    const particles: any[] = [];
    const started = Date.now();
    let thrown: string | undefined;
    try {
      for await (const particle of executeChatGenerateWithContinuation(() => createChatGenerateDispatch(access, c.model, chatGenerate, c.streaming, undefined, false), stop.signal, _d)) {
        particles.push(structuredClone(particle));
        reassembler.enqueueWireParticle(particle);
      }
    } catch (error: any) {
      thrown = `${error?.name}: ${String(error?.message).replace(/\s+/g, ' ').slice(0, 80)}`;
    }
    clearTimeout(timer);
    await reassembler.waitForWireComplete();
    if (stop.signal.aborted && !reassembler.hasWireEnd) reassembler.setClientAborted(); // as aix.client.ts on a Stop
    return rowOf(c.id, started, particles, reassembler.finalizeReassembly(), thrown);
  }

  /** The relay's faults, each on a plain answer: the shared defects, then the ones only a relay has (relay.mjs) */
  const RELAY_FAULTS = ['none', 'http413', 'http502', 'json502', 'html', 'refuse', 'cut8', 'reset8', 'badinput', 'noend', 'badparticle'];

  async function runRelay(fault: string, streaming: boolean): Promise<Row> {
    const { apiStream } = await import(`${TREE}/src/common/util/trpc.client`);
    const { aixClassifyStreamingError } = await import(`${TREE}/src/modules/aix/client/aix.client.errors`);
    await fetch(`${relayUrl}/__sim?fault=${fault}`);
    const input = {
      access: ACCESS.openai(service.url), model: { id: 'sim-ok', acceptsOutputs: ['text'] },
      chatGenerate: { systemMessage: null, chatSequence: [{ role: 'user', parts: [{ pt: 'text', text: 'hi' }] }] },
      context: { method: 'chat-generate', name: 'conversation', ref: 'simulator' }, streaming,
    };
    const stop = new AbortController();
    const reassembler = new ContentReassembler({ mgt: 'aix', name: 'sim-ok', aix: { vId: 'openai', mId: 'sim-ok' } }, undefined, undefined, [], true, undefined, undefined, stop.signal);
    const particles: any[] = [];
    const started = Date.now();
    let thrown: string | undefined;
    try {
      // as aix.client.ts: enqueue as they arrive, then drain
      for await (const particle of await apiStream.aix.chatGenerateContent.mutate(input, { signal: stop.signal })) {
        particles.push(structuredClone(particle));
        reassembler.enqueueWireParticle(particle);
      }
      await reassembler.waitForWireComplete();
    } catch (error: any) {
      await reassembler.waitForWireComplete();
      thrown = `${error?.name}: ${String(error?.message).replace(/\s+/g, ' ').slice(0, 80)}`;
      const issue = aixClassifyStreamingError(error, { aborted: stop.signal.aborted, path: 'trpc' });
      if (issue) reassembler.setClientExcepted(issue);
      else if (!reassembler.hasWireEnd) reassembler.setClientAborted();
    }
    return rowOf(`relay/${fault}${streaming ? '' : ' [whole]'}`, started, particles, reassembler.finalizeReassembly(), thrown);
  }

  const rows: Row[] = [];
  const quiet = silence();
  function report(row: Row) {
    rows.push(row);
    log(`${row.id.padEnd(74)} ${line(row)}`);
    if (verbose) {
      for (const issue of row.issues) if (issue.text) log(`    ${issue.code}: ${issue.text}`);
      log(`    ${row.fragments}${row.text ? `   "${row.text}"` : ''}   ${row.ms}ms`);
    }
  }

  if (relayUrl) {
    for (const fault of RELAY_FAULTS.filter(f => !words.length || words.some(word => f.includes(word))))
      for (const streaming of [true, false])
        report(await runRelay(fault, streaming));
    await fetch(`${relayUrl}/__sim?fault=none`);
  } else {
    // a few at a time (the waits are the retriers' own), reported in case order
    const done: (Row | undefined)[] = selected.map(() => undefined);
    let next = 0, reported = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      for (let at = next++; at < selected.length; at = next++) {
        done[at] = await runChain(selected[at]);
        for (let row = done[reported]; row; row = done[++reported]) report(row);
      }
    }));
  }
  quiet.restore();

  const outcomes = rows.reduce<Record<string, number>>((acc, row) => (acc[row.outcome] = (acc[row.outcome] ?? 0) + 1, acc), {});
  log(`\n${rows.length} rows: ${Object.entries(outcomes).map(([outcome, n]) => `${n} ${outcome}`).join(', ')}${rows.some(r => r.thrown) ? `; ${rows.filter(r => r.thrown).length} threw` : ''}`);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
  await service.close();
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
