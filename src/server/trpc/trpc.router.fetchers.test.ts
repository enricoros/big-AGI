/// <reference types="node" />
// Run: `NODE_ENV=development npx tsx --test src/server/trpc/trpc.router.fetchers.test.ts`
// What a TRPCFetcherError carries for a caller that writes its own report: the failing side's words (`causeText`) and the
// error class (`httpErrorType`). `httpErrorCode` is the connect retrier's input, so the class travels apart from it.
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { fetchResponseOrTRPCThrow, TRPCFetcherError } from './trpc.router.fetchers';


const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

async function failure(fetchImpl: typeof fetch, url = 'https://service.invalid/v1/chat/completions?key=secret'): Promise<TRPCFetcherError> {
  globalThis.fetch = fetchImpl;
  const { log } = console;
  console.log = () => undefined; // the fetcher logs each failure
  try {
    await fetchResponseOrTRPCThrow({ url, name: 'Test' });
  } catch (error) {
    assert.ok(error instanceof TRPCFetcherError);
    return error;
  } finally {
    console.log = log;
  }
  assert.fail('the fetch did not throw');
}

const httpFailure = (status: number, body: object | string) =>
  failure(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

const connectFailure = (cause: Error & { code?: string }, url?: string) =>
  failure(async () => { throw new TypeError('fetch failed', { cause }); }, url);


// key-shaped for the scrub rule, and assembled here so that no key-shaped literal sits in the source
const KEY_SHAPED = 'AIza' + 'x'.repeat(35);

describe('TRPCFetcherError: an HTTP answer', () => {

  it('an error class is not a code: a 429 whose type names a retry profile keeps the retrier input of a plain 429', async () => {
    const error = await httpFailure(429, { error: { type: 'resource_unavailable', code: null, message: 'Busy, try later.' } });
    assert.deepEqual([error.httpErrorCode, error.httpErrorType, error.causeText], [undefined, 'resource_unavailable', 'Busy, try later.']);
  });

  it('a Gemini status name is the type; a string code stays the code', async () => {
    const gemini = await httpFailure(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded.' } });
    assert.deepEqual([gemini.httpErrorCode, gemini.httpErrorType], [undefined, 'RESOURCE_EXHAUSTED']);
    const openai = await httpFailure(429, { error: { type: 'tokens', code: 'rate_limit_exceeded', message: 'Rate limit reached.' } });
    assert.deepEqual([openai.httpErrorCode, openai.httpErrorType], ['rate_limit_exceeded', 'tokens']);
  });

  it('the cause text is the body without our framing, with a quoted Gemini key scrubbed', async () => {
    const error = await httpFailure(403, { error: { status: 'PERMISSION_DENIED', message: 'Requests from referer x are blocked. key ' + KEY_SHAPED } });
    assert.equal(error.causeText, 'Requests from referer x are blocked. key AIza...');
    assert.match(error.message, /Upstream responded with HTTP 403/);
  });

  it('the address follows the body when it is the likely cause, without its query, and the body is cut to leave it room', async () => {
    const ADDRESS = 'https://service.invalid/v1/chat/completions';
    // a proxy's own 404, an empty 502: no vendor reason
    assert.equal((await httpFailure(404, { error: 'Not Found' })).causeText, `Not Found - ${ADDRESS}`);
    assert.equal((await httpFailure(502, '')).causeText, ADDRESS);
    const long = (await httpFailure(404, '<html>' + 'x'.repeat(2000))).causeText!;
    assert.ok(long.length <= 480 && long.endsWith(`... - ${ADDRESS}`), long);
    // the vendor answered and named the cause: no address
    assert.equal((await httpFailure(404, { error: { type: 'not_found_error', message: 'model: nope-1' } })).causeText, 'model: nope-1');
  });

});


describe('TRPCFetcherError: a connection failure', () => {

  it('the cause text is the runtime\'s words, then the host unless the cause names it', async () => {
    const refused = await connectFailure(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), { code: 'ECONNREFUSED' }));
    assert.deepEqual([refused.category, refused.connErrorName, refused.causeText], ['connection', 'ECONNREFUSED', 'fetch failed - connect ECONNREFUSED 127.0.0.1:443 - host: service.invalid']);
    const dns = await connectFailure(Object.assign(new Error('getaddrinfo ENOTFOUND service.invalid'), { code: 'ENOTFOUND' }));
    assert.equal(dns.causeText, 'fetch failed - getaddrinfo ENOTFOUND service.invalid');
  });

  it('an API key pasted as the host never enters it', async () => {
    const KEY = 'sk0abcdefghijklmnopqrstuvwxyz123456';
    const error = await connectFailure(Object.assign(new Error(`getaddrinfo ENOTFOUND ${KEY}`), { code: 'ENOTFOUND' }), `https://${KEY}/v1/models`);
    assert.equal(error.causeText, 'fetch failed - getaddrinfo ENOTFOUND (hidden: looks like an API key)');
  });

});
