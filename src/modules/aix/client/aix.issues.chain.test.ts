/// <reference types="node" />
// Run: `NODE_ENV=development npx tsx --test src/modules/aix/client/aix.issues.chain.test.ts`
// The chain gate: a service failure, through the real dispatch creation, fetcher, executor chain (continuation, operation
// retry, connect retrier) and reassembler, lands as the records, stored stop reason and outcome stated here. `fetch` is
// stubbed; tools/develop/aix-failure-simulator serves the same failures over real HTTP, to the chain and to the running app.
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

// relative imports: the root tsconfig excludes tests, so the IDE's inferred project has no '~' paths (tsx and tools/tsconfig do)
import type { DMessageGenerator } from '../../../common/stores/chat/chat.message';

import type { AixAPI_Access, AixAPI_Model, AixAPIChatGenerate_Request, AixWire_Particles } from '../server/api/aix.wiretypes';
import type { AixDebugObject } from '../server/dispatch/chatGenerate/chatGenerate.debug';
import type { DAixIssue } from '../shared/aix.issues';
import { createChatGenerateDispatch } from '../server/dispatch/chatGenerate/chatGenerate.dispatch';
import { executeChatGenerateWithContinuation } from '../server/dispatch/chatGenerate/chatGenerate.continuation';

import { ContentReassembler } from './ContentReassembler';


type Op = AixWire_Particles.ChatGenerateOp;


// --- the service: the mock's bodies ---

const MODEL = 'mock-model';
const WORDS = 'The quick brown fox jumps over the lazy dog, twice, then rests under the old oak tree.'.split(' ');
const USAGE = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 };
const SERVER_ERROR = { message: 'The server had an error while processing your request. Sorry about that!', type: 'server_error', param: null, code: 'server_error' };

const chunk = (delta: object, finish: string | null = null, extra: object = {}) =>
  `data: ${JSON.stringify({ id: 'chatcmpl-mock', object: 'chat.completion.chunk', created: 1700000000, model: MODEL, choices: [{ index: 0, delta, finish_reason: finish }], ...extra })}\n\n`;
const say = (count: number) => WORDS.slice(0, count).map((word, i) => chunk(i === 0 ? { role: 'assistant', content: word } : { content: ' ' + word }));
const finish = (reason: string) => chunk({}, reason, { usage: USAGE });
const DONE = 'data: [DONE]\n\n';
const ERROR_CHUNK = `data: ${JSON.stringify({ error: SERVER_ERROR })}\n\n`;

const ANSWER = WORDS.join(' ');
const FIRST_FOUR = WORDS.slice(0, 4).join(' ');

/** What the service does with one request: answer (its body in chunks, then close, reset, or hang until the request is aborted), or fail to connect */
type Reply =
  | { status: number, contentType: string, chunks: string[], reset?: true, hang?: true, headers?: Record<string, string> }
  | { connectError: Error };

const sse = (...chunks: string[]): Reply => ({ status: 200, contentType: 'text/event-stream', chunks });
const json = (status: number, body: object, headers?: Record<string, string>): Reply => ({ status, contentType: 'application/json', chunks: [JSON.stringify(body)], headers });
const completion = (finishReason: string | null): Reply =>
  json(200, { id: 'chatcmpl-mock', object: 'chat.completion', created: 1700000000, model: MODEL, choices: [{ index: 0, message: { role: 'assistant', content: ANSWER }, finish_reason: finishReason }], usage: USAGE });

const HTTP_ERRORS = {
  401: { error: { message: 'Incorrect API key provided: sk-mock. You can find your API key at https://platform.example.com/account/api-keys.', type: 'invalid_request_error', param: null, code: 'invalid_api_key' } },
  402: { error: { message: 'Insufficient credits. Add more using https://example.com/settings/credits', code: 402 } },
  403: { error: { message: 'Country, region, or territory not supported', type: 'request_forbidden', code: 'unsupported_country_region_territory' } },
  404: { error: { message: `The model \`${MODEL}\` does not exist or you do not have access to it.`, type: 'invalid_request_error', param: null, code: 'model_not_found' } },
  500: { error: { message: 'The server had an error while processing your request. Sorry about that!', type: 'server_error', param: null, code: null } },
} as const;

/**
 * The body, one chunk per read; the reset is a TypeError('terminated') on the read after the last chunk, as Node's fetch throws it.
 * A hanging body waits after its last chunk, and errors with an AbortError when the request's signal fires, as fetch does.
 */
function responseOf(reply: Extract<Reply, { status: number }>, signal: AbortSignal | undefined): Response {
  const encoder = new TextEncoder();
  let next = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (next < reply.chunks.length)
        controller.enqueue(encoder.encode(reply.chunks[next++]));
      else if (reply.reset)
        controller.error(new TypeError('terminated'));
      else if (reply.hang && signal)
        return new Promise<void>(resolve => {
          const abort = () => {
            controller.error(new DOMException('This operation was aborted', 'AbortError'));
            resolve();
          };
          if (signal.aborted) abort();
          else signal.addEventListener('abort', abort, { once: true });
        });
      else
        controller.close();
    },
  }, { highWaterMark: 0 });
  return new Response(body, { status: reply.status, headers: { 'content-type': reply.contentType, ...reply.headers } });
}


// --- the chain ---

const ACCESS = { dialect: 'openai', oaiKey: 'sk-mock', oaiOrg: '', oaiHost: 'http://127.0.0.1:8791' } as const satisfies AixAPI_Access;
const MODEL_REF: AixAPI_Model = { id: MODEL, acceptsOutputs: ['text'] };
const REQUEST: AixAPIChatGenerate_Request = { systemMessage: null, chatSequence: [{ role: 'user', parts: [{ pt: 'text', text: 'hi' }] }] };
const GENERATOR: DMessageGenerator = { mgt: 'aix', name: MODEL, aix: { vId: 'openai', mId: MODEL } };

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

async function generate(reply: Reply, streaming: boolean, runtime: AixDebugObject['runtime'] = 'relay', stopAfterMs?: number) {
  let requests = 0;
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    requests++;
    if ('connectError' in reply) throw reply.connectError;
    return responseOf(reply, init?.signal ?? undefined);
  };

  // the user's Stop: the intake signal, which the chain passes down to the fetch
  const stop = new AbortController();
  const stopTimer = stopAfterMs === undefined ? undefined : setTimeout(() => stop.abort(), stopAfterMs);

  const _d: AixDebugObject = { runtime, prettyDialect: 'OpenAI', echoRequest: false, requestBodyOverride: undefined, consoleLogErrors: false, profiler: undefined, wire: undefined };
  const particles: Op[] = [];
  const reassembler = new ContentReassembler(GENERATOR, undefined, undefined, [], true, undefined, undefined, stop.signal);

  // the chain logs each failure as it goes: keep the test output to the results
  const { log, warn, error } = console;
  console.log = console.warn = console.error = () => undefined;
  try {
    // particles enter the reassembler as they arrive, as in aix.client.ts
    for await (const op of executeChatGenerateWithContinuation(() => createChatGenerateDispatch(ACCESS, MODEL_REF, REQUEST, streaming, undefined, false), stop.signal, _d)) {
      particles.push(structuredClone(op));
      reassembler.enqueueWireParticle(op);
    }
    await reassembler.waitForWireComplete();
    if (stop.signal.aborted && !reassembler.hasWireEnd) // as aix.client.ts on a Stop
      reassembler.setClientAborted();
  } finally {
    clearTimeout(stopTimer);
    Object.assign(console, { log, warn, error });
  }

  const { fragments, generator, outcome } = reassembler.finalizeReassembly();
  return {
    requests,
    particles,
    sent: particles.filter((op): op is Extract<Op, { cg: 'aix-issue' }> => 'cg' in op && op.cg === 'aix-issue').map(op => op.issue),
    end: particles.filter((op): op is Extract<Op, { cg: 'end' }> => 'cg' in op && op.cg === 'end').map(op => [op.terminationReason, op.tokenStopReason] as const)[0],
    stored: fragments.flatMap(fragment => fragment.ft === 'content' && fragment.part.pt === 'aix.issue' ? [fragment.part.issue] : []),
    text: fragments.map(fragment => fragment.ft === 'content' && fragment.part.pt === 'text' ? fragment.part.text : '').join(''),
    stop: generator.tokenStopReason,
    outcome,
  };
}


// --- the rows ---

/** [code, effect, causeCode, httpStatus] of one record */
type IssueFacts = [DAixIssue['code'], DAixIssue['effect'], string?, number?];

type Row = {
  scenario: string,
  reply: Reply,
  /** the records sent, and stored: every one, in wire order */
  issues: IssueFacts[],
  /** the records stored, when not the ones sent: a Stop stores none */
  stored?: IssueFacts[],
  /** [terminationReason, tokenStopReason] of the end particle: a failed issue travels with an error-class stop reason */
  end: [AixWire_Particles.CGEndReason, AixWire_Particles.GCTokenStopReason | undefined],
  /** what the first record holds of the service's own words, in its `text` or `detail` */
  says?: { text?: string, detail?: string },
  stop: Awaited<ReturnType<typeof generate>>['stop'],
  outcome: Awaited<ReturnType<typeof generate>>['outcome'],
  /** the answer text the message keeps */
  text?: string,
};

function check(row: Row, result: Awaited<ReturnType<typeof generate>>) {
  const { particles, sent, stored } = result;

  // exactly one end, and it is the last particle
  const ends = particles.filter(op => 'cg' in op && op.cg === 'end');
  assert.equal(ends.length, 1, 'one end');
  assert.equal(particles.at(-1), ends[0], 'the end is the last particle');
  assert.deepEqual(result.end, row.end, 'the end particle');

  const facts = (issue: DAixIssue): IssueFacts => {
    const row: IssueFacts = [issue.code, issue.effect];
    if (issue.causeCode !== undefined || issue.httpStatus !== undefined) row.push(issue.causeCode);
    if (issue.httpStatus !== undefined) row.push(issue.httpStatus);
    return row;
  };
  assert.deepEqual(sent.map(facts), row.issues, 'the records sent');
  assert.deepEqual(stored.map(facts), row.stored ?? row.issues, 'the records stored');
  assert.ok(stored.filter(issue => issue.effect === 'failed').length <= 1, 'at most one issue fails');

  if (row.says?.text)
    assert.ok(stored[0]?.text.includes(row.says.text), `the text holds the service's words: ${stored[0]?.text}`);
  if (row.says?.detail)
    assert.ok(stored[0]?.detail?.includes(row.says.detail), `the detail holds the service's words: ${stored[0]?.detail}`);
  for (const issue of stored)
    assert.ok(issue.text && !/\*\*|^\s*\[/.test(issue.text), `one plain sentence, no markup or label: ${issue.text}`);

  assert.equal(result.stop, row.stop, 'the stored stop reason');
  assert.equal(result.outcome, row.outcome, 'the outcome');
  if (row.text !== undefined)
    assert.equal(result.text, row.text, 'the answer text');
}

const STREAMING: Row[] = [
  { scenario: 'ok', reply: sse(...say(99), finish('stop'), DONE), end: ['done-dialect', 'ok'], issues: [], stop: undefined, outcome: 'completed', text: ANSWER },
  { scenario: 'length', reply: sse(...say(6), finish('length'), DONE), end: ['done-dialect', 'out-of-tokens'], issues: [], stop: 'out-of-tokens', outcome: 'truncated' },
  { scenario: 'no finish reason', reply: sse(...say(6), DONE), end: ['done-dialect', undefined], issues: [['model-unfinished', 'notice']], stop: undefined, outcome: 'completed' },
  { scenario: 'empty', reply: sse(DONE), end: ['done-dialect', undefined], issues: [['model-unfinished', 'notice']], stop: undefined, outcome: 'completed', text: '' },
  {
    scenario: 'http 401', reply: json(401, HTTP_ERRORS[401]),
    end: ['issue-dispatch-rpc', 'cg-issue'], issues: [['dispatch-http', 'failed', 'invalid_api_key', 401]], says: { detail: 'Incorrect API key provided' }, stop: 'issue', outcome: 'failed',
  },
  {
    scenario: 'http 402 (a numeric code is no vendor code)', reply: json(402, HTTP_ERRORS[402]),
    end: ['issue-dispatch-rpc', 'cg-issue'], issues: [['dispatch-http', 'failed', undefined, 402]], says: { detail: 'Insufficient credits' }, stop: 'issue', outcome: 'failed',
  },
  {
    scenario: 'http 403', reply: json(403, HTTP_ERRORS[403]),
    end: ['issue-dispatch-rpc', 'cg-issue'], issues: [['dispatch-http', 'failed', 'unsupported_country_region_territory', 403]], says: { detail: 'Country, region, or territory not supported' }, stop: 'issue', outcome: 'failed',
  },
  {
    scenario: 'http 404', reply: json(404, HTTP_ERRORS[404]),
    end: ['issue-dispatch-rpc', 'cg-issue'], issues: [['dispatch-http', 'failed', 'model_not_found', 404]], says: { detail: 'does not exist or you do not have access to it' }, stop: 'issue', outcome: 'failed',
  },
  {
    scenario: 'http 404 with no vendor reason: the address is the likely cause, so the detail holds it', reply: { status: 404, contentType: 'text/plain', chunks: ['Not Found'] },
    end: ['issue-dispatch-rpc', 'cg-issue'], issues: [['dispatch-http', 'failed', undefined, 404]], says: { detail: 'Not Found - http://127.0.0.1:8791/v1/chat/completions' }, stop: 'issue', outcome: 'failed',
  },
  {
    scenario: 'http 404 with a long HTML page (a web server at a wrong base URL): the page is cut, the address kept', reply: { status: 404, contentType: 'text/html', chunks: [`<!DOCTYPE html><html><body>${'x'.repeat(700)}</body></html>`] },
    end: ['issue-dispatch-rpc', 'cg-issue'], issues: [['dispatch-http', 'failed', undefined, 404]], says: { detail: 'xxx... - http://127.0.0.1:8791/v1/chat/completions' }, stop: 'issue', outcome: 'failed',
  },
  {
    scenario: 'http 413 in plain text', reply: { status: 413, contentType: 'text/plain', chunks: ['Request Entity Too Large'] },
    end: ['issue-dispatch-rpc', 'cg-issue'], issues: [['dispatch-http', 'failed', undefined, 413]], says: { detail: 'Request Entity Too Large' }, stop: 'issue', outcome: 'failed',
  },
  {
    scenario: 'http 500 (the type when the code is null)', reply: json(500, HTTP_ERRORS[500]),
    end: ['issue-dispatch-rpc', 'cg-issue'], issues: [['dispatch-http', 'failed', 'server_error', 500]], says: { detail: 'The server had an error while processing your request' }, stop: 'issue', outcome: 'failed',
  },
  {
    scenario: 'an HTML page with a 200', reply: { status: 200, contentType: 'text/html', chunks: ['<!DOCTYPE html><html><body>Sign in to the network</body></html>'] },
    end: ['done-dispatch-closed', 'cg-issue'], issues: [['dispatch-cutoff', 'failed']], stop: 'issue', outcome: 'failed', text: '',
  },
  {
    scenario: 'a reset mid-stream', reply: { ...sse(...say(4)), reset: true } as Reply,
    end: ['issue-dispatch-rpc', 'cg-issue'], issues: [['dispatch-read', 'failed']], stop: 'issue', outcome: 'failed', text: FIRST_FOUR,
  },
  {
    scenario: 'a clean cut mid-stream', reply: sse(...say(4)),
    end: ['done-dispatch-closed', 'cg-issue'], issues: [['dispatch-cutoff', 'failed']], stop: 'issue', outcome: 'failed', text: FIRST_FOUR,
  },
  {
    scenario: 'an in-stream error after text', reply: sse(...say(4), ERROR_CHUNK, DONE),
    end: ['issue-dialect', 'cg-issue'], issues: [['service-error', 'failed', 'server_error']], says: { text: SERVER_ERROR.message }, stop: 'issue', outcome: 'failed', text: FIRST_FOUR,
  },
  {
    scenario: 'a content_filter finish', reply: sse(...say(4), finish('content_filter'), DONE),
    end: ['done-dialect', 'filter-content'], issues: [['model-filter', 'failed', 'content_filter']], stop: 'filter', outcome: 'failed', text: FIRST_FOUR,
  },
  {
    scenario: 'a chunk that fails the schema', reply: sse(...say(4), 'data: {"id": "chatcmpl-mock", "choices": [{"index": 0, "delta": {"content": 42}}]}\n\n', 'data: {not json\n\n', DONE),
    end: ['issue-dispatch-rpc', 'cg-issue'], issues: [['dispatch-parse', 'failed']], says: { detail: '"content": 42' }, stop: 'issue', outcome: 'failed', text: FIRST_FOUR,
  },
  {
    scenario: 'an error after the finish (the answer stands)', reply: sse(...say(99), finish('stop'), ERROR_CHUNK, DONE),
    end: ['issue-dialect', 'ok'], issues: [['service-error', 'notice', 'server_error']], says: { text: SERVER_ERROR.message }, stop: undefined, outcome: 'completed', text: ANSWER,
  },
];

// the non-streaming twins where the result differs: the body is read whole, then parsed once
const NON_STREAMING: Row[] = [
  { scenario: 'ok', reply: completion('stop'), end: ['done-dispatch-closed', 'ok'], issues: [], stop: undefined, outcome: 'completed', text: ANSWER },
  { scenario: 'length', reply: completion('length'), end: ['done-dispatch-closed', 'out-of-tokens'], issues: [], stop: 'out-of-tokens', outcome: 'truncated', text: ANSWER },
  { scenario: 'no finish reason: read in full, so not a cutoff', reply: completion(null), end: ['done-dialect', undefined], issues: [['model-unfinished', 'notice']], stop: undefined, outcome: 'completed', text: ANSWER },
  { scenario: 'a content_filter finish', reply: completion('content_filter'), end: ['done-dispatch-closed', 'filter-content'], issues: [['model-filter', 'failed', 'content_filter']], stop: 'filter', outcome: 'failed', text: ANSWER },
  {
    scenario: 'an HTML page with a 200: not JSON', reply: { status: 200, contentType: 'text/html', chunks: ['<!DOCTYPE html><html><body>Sign in to the network</body></html>'] },
    end: ['issue-dispatch-rpc', 'cg-issue'], issues: [['dispatch-parse', 'failed']], says: { detail: 'Sign in to the network' }, stop: 'issue', outcome: 'failed', text: '',
  },
  {
    scenario: 'a reset while reading the body', reply: { ...completion('stop'), chunks: ['{"id": "chatcmpl-mock", "choices": ['], reset: true } as Reply,
    end: ['issue-dispatch-rpc', 'cg-issue'], issues: [['dispatch-read', 'failed']], stop: 'issue', outcome: 'failed', text: '',
  },
];


describe('AIX issues chain: service failures as stored records', () => {

  describe('streaming', () => {
    for (const row of STREAMING)
      test(row.scenario, async () => check(row, await generate(row.reply, true)));
  });

  describe('non-streaming', () => {
    for (const row of NON_STREAMING)
      test(row.scenario, async () => check(row, await generate(row.reply, false)));
  });

  // a Stop while the body is read: the executor closes the aborted run with its record and the end, and the client applies
  // nothing after the Stop, on both runtimes (under Direct Connection the intake signal is the Stop)
  describe('a user Stop', () => {
    const stopped = (reply: Reply, text: string): Row =>
      ({ scenario: 'stop', reply, end: ['done-dispatch-aborted', 'cg-issue'], issues: [['dispatch-aborted', 'failed']], stored: [], stop: 'client-abort', outcome: 'aborted', text });
    for (const runtime of ['relay', 'client'] as const) {
      test(`mid-stream, ${runtime}`, async () => {
        const reply: Reply = { ...sse(...say(4)), hang: true } as Reply;
        check(stopped(reply, FIRST_FOUR), await generate(reply, true, runtime, 50));
      });
      test(`while reading a non-streaming body, ${runtime}`, async () => {
        const reply: Reply = { ...completion('stop'), chunks: ['{"id": "chatcmpl-mock", "choices": ['], hang: true } as Reply;
        check(stopped(reply, ''), await generate(reply, false, runtime, 50));
      });
    }
  });

  describe('runtime client (Direct Connection)', () => {

    test('a failed connect is retried, then stored with the engine text and the host; no class name as the code', async () => {
      const result = await generate({ connectError: new TypeError('Failed to fetch') }, true, 'client');
      check({ scenario: 'connect', reply: { connectError: new TypeError() }, end: ['issue-dispatch-rpc', 'cg-issue'], issues: [['dispatch-connect', 'failed']], says: { detail: '127.0.0.1:8791' }, stop: 'issue', outcome: 'failed', text: '' }, result);
      const [issue] = result.stored;
      assert.equal(result.requests, 3, 'the connect retrier ran its attempts');
      assert.deepEqual({ runtime: issue.runtime, detail: issue.detail }, { runtime: 'client', detail: 'Failed to fetch - host: 127.0.0.1:8791' });
    });

    test('a reset mid-stream is the browser\'s own drop', async () => {
      const result = await generate({ ...sse(...say(4)), reset: true } as Reply, true, 'client');
      check({ scenario: 'reset', reply: sse(), end: ['issue-dispatch-rpc', 'cg-issue'], issues: [['dispatch-read', 'failed']], stop: 'issue', outcome: 'failed', text: FIRST_FOUR }, result);
      assert.deepEqual({ runtime: result.stored[0].runtime, detail: result.stored[0].detail }, { runtime: 'client', detail: 'terminated' });
    });

  });

});
