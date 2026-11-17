/// <reference types="node" />

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { env } from '~/server/env.server';

import { contextSearchRouter } from './search.router';


const CLIENT_KEY = 'context-test-client-key';
const SERVER_KEY = 'context-test-server-key';
const originalServerKey = Reflect.get(env, 'CONTEXT_DEV_API_KEY');
const originalFetch = globalThis.fetch;
const controller = () => new AbortController();
const caller = (signal = controller().signal) => contextSearchRouter.createCaller({ hostName: 'localhost', reqSignal: signal });
const input = { query: 'agent web search', items: 10, restrictToDomain: null };
const result = { title: 'Example', url: 'https://example.com/article', description: 'Source description' };

beforeEach(() => {
  Reflect.set(env, 'CONTEXT_DEV_API_KEY', undefined);
  globalThis.fetch = async () => { throw new Error('Unexpected upstream request'); };
});

afterEach(() => {
  Reflect.set(env, 'CONTEXT_DEV_API_KEY', originalServerKey);
  globalThis.fetch = originalFetch;
});


describe('Context standalone search router', () => {
  test('uses POST with header credentials, domain filtering and normalized results', async () => {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://api.context.dev/v1/web/search');
      assert.equal(init?.method, 'POST');
      assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${CLIENT_KEY}`);
      assert.equal(new Headers(init?.headers).get('content-type'), 'application/json');
      assert.deepEqual(JSON.parse(String(init?.body)), {
        query: 'agent web search', numResults: 10, includeDomains: ['example.com'],
      });
      assert.ok(!String(url).includes(CLIENT_KEY));
      return Response.json({ results: [result], query: input.query, request_id: 'test-request' });
    };
    assert.deepEqual(await caller().search({ ...input, query: ` ${input.query} `, key: ` ${CLIENT_KEY} `, restrictToDomain: ' example.com ' }), {
      pages: [{ title: 'Example', link: result.url, snippet: result.description }],
    });
  });

  test('uses the server key only when no nonblank client key was supplied', async () => {
    Reflect.set(env, 'CONTEXT_DEV_API_KEY', SERVER_KEY);
    const authorizations: (string | null)[] = [];
    globalThis.fetch = async (_url, init) => {
      authorizations.push(new Headers(init?.headers).get('authorization'));
      return Response.json({ results: [] });
    };
    await caller().search(input);
    await caller().search({ ...input, key: ' ' });
    await caller().search({ ...input, key: CLIENT_KEY });
    assert.deepEqual(authorizations, [`Bearer ${SERVER_KEY}`, `Bearer ${SERVER_KEY}`, `Bearer ${CLIENT_KEY}`]);
  });

  test('fails before fetching when no key is configured', async () => {
    await assert.rejects(caller().search({ ...input, key: ' ' }), /Context\.dev API key/);
  });

  test('accepts empty search results and absent or null descriptions', async () => {
    globalThis.fetch = async () => Response.json({ results: [] });
    assert.deepEqual(await caller().search({ ...input, key: CLIENT_KEY }), { pages: [] });
    globalThis.fetch = async () => Response.json({ results: [
      { title: 'One', url: 'https://example.com/1' },
      { title: 'Two', url: 'https://example.com/2', description: null },
    ] });
    assert.deepEqual(await caller().search({ ...input, key: CLIENT_KEY }), { pages: [
      { title: 'One', link: 'https://example.com/1', snippet: '' },
      { title: 'Two', link: 'https://example.com/2', snippet: '' },
    ] });
  });

  test('omits blank domain filters and enforces the requested result count', async () => {
    globalThis.fetch = async (_url, init) => {
      assert.deepEqual(JSON.parse(String(init?.body)), { query: input.query, numResults: 1 });
      return Response.json({ results: [result, { ...result, title: 'Second' }] });
    };
    const response = await caller().search({ ...input, key: CLIENT_KEY, items: 1, restrictToDomain: ' ' });
    assert.equal(response.pages.length, 1);
  });

  test('validates query, result bounds and domain before fetching', async () => {
    for (const invalid of [
      { query: ' ' }, { items: 0 }, { items: 101 }, { items: 1.5 },
      { restrictToDomain: 'https://example.com/private' }, { restrictToDomain: 'example.com/path' },
      { restrictToDomain: 'example.com?api_key=secret' },
    ])
      await assert.rejects(caller().search({ ...input, key: CLIENT_KEY, ...invalid }));
    globalThis.fetch = async (_url, init) => {
      assert.equal(JSON.parse(String(init?.body)).numResults, 100);
      return Response.json({ results: [] });
    };
    await caller().search({ ...input, key: CLIENT_KEY, items: 100 });
  });

  for (const [status, message] of [[401, /API key/i], [403, /access/i], [402, /credits/i], [429, /rate limit/i], [503, /unavailable/i]] as const) {
    test(`reports HTTP ${status} without exposing upstream credential echoes`, async (t) => {
      const logs: unknown[][] = [];
      t.mock.method(console, 'log', (...args: unknown[]) => logs.push(args));
      t.mock.method(console, 'warn', (...args: unknown[]) => logs.push(args));
      t.mock.method(console, 'error', (...args: unknown[]) => logs.push(args));
      globalThis.fetch = async () => Response.json({ error: { message: `Rejected ${CLIENT_KEY}` } }, { status });
      await assert.rejects(caller().search({ ...input, key: CLIENT_KEY }), error => {
        assert.match(String(error), message);
        assert.ok(!String(error).includes(CLIENT_KEY));
        return true;
      });
      assert.ok(!JSON.stringify(logs).includes(CLIENT_KEY));
    });
  }

  test('does not treat invalid success payloads as empty results', async () => {
    for (const body of [{}, { error: 'rejected' }, { results: [{ title: 'Missing URL' }] }, { results: [{ ...result, url: 'javascript:alert(1)' }] }]) {
      globalThis.fetch = async () => Response.json(body);
      await assert.rejects(caller().search({ ...input, key: CLIENT_KEY }), /invalid.*response/i);
    }
    globalThis.fetch = async () => new Response('<html>upstream proxy failure</html>');
    await assert.rejects(caller().search({ ...input, key: CLIENT_KEY }), /invalid.*response/i);
  });

  test('reports network failure without echoing request secrets', async () => {
    globalThis.fetch = async () => { throw new Error(`Connection failed with ${CLIENT_KEY}`); };
    await assert.rejects(caller().search({ ...input, key: CLIENT_KEY }), error => {
      assert.match(String(error), /connect/i);
      assert.ok(!String(error).includes(CLIENT_KEY));
      return true;
    });
  });

  test('reports an upstream timeout without treating it as an empty result', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const request = controller();
    const removedListener = t.mock.method(request.signal, 'removeEventListener');
    const clearedTimer = t.mock.method(globalThis, 'clearTimeout');
    let started: () => void;
    const upstreamStarted = new Promise<void>(resolve => { started = resolve; });
    let upstreamSignal: AbortSignal;
    globalThis.fetch = async (_url, init) => {
      upstreamSignal = init!.signal!;
      return new Promise<Response>((_resolve, reject) => {
        upstreamSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        started();
      });
    };
    const pending = caller(request.signal).search({ ...input, key: CLIENT_KEY });
    await upstreamStarted;
    t.mock.timers.tick(20_000);
    await assert.rejects(pending, /timed out/i);
    assert.equal(upstreamSignal!.aborted, true);
    assert.ok(clearedTimer.mock.callCount() > 0);
    assert.ok(removedListener.mock.calls.some(call => call.arguments[0] === 'abort'));
  });

  test('cancels the upstream request when the caller aborts', async () => {
    const abortController = controller();
    globalThis.fetch = async (_url, init) => {
      assert.ok(init?.signal);
      return new Promise<Response>((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        abortController.abort();
      });
    };
    await assert.rejects(caller(abortController.signal).search({ ...input, key: CLIENT_KEY }), /cancel/i);
  });
});
