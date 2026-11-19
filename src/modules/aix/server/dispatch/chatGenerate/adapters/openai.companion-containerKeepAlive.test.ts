/// <reference types="node" />

// The OpenAI container keep-alive at scale, on a mocked clock and an in-memory Containers API: no network, no key, no waiting.
//
// Why: the keeper's discovery is a time-windowed, paginated listing of the newest containers, deduplicated across every live
// registration and pinged through a small pool. Running 100 real pro-mode rays costs hundreds of dollars; this drives the same
// code with 100 staggered registrations against a listing that mixes our containers with same-second neighbors, expired and
// explicit ones, and older ones, then checks that the abort exit stops everything before the first tick.
//
// Two groups, each one run of the keeper followed by one test per fact:
// - "100 dispatches, one shared tick": what a tick lists and what it pings
// - "aborted before the first tick": the abort exit releases the registrations, so nothing is listed or pinged
// The expected counts come from the population below, not from what the keeper returns.
//
// Not covered here: the real API's listing contract (`order=desc`, `after=<last_id>`, `has_more`, `last_id`), checked against
// api.openai.com on 2026-10-31, and the end-to-end effect, measured there with pro-mode runs whose first cell came after 20
// minutes: cells fail without the keep-alive, succeed with it.

import assert from 'node:assert/strict';
import { after, before, describe, mock, test } from 'node:test';

import { OpenAIContainerKeepAlive } from './openai.companion-containerKeepAlive';


// the population: what a listing returns, newest first
const OURS = 200;            // 100 pro-mode rays, two containers each, created in the same seconds as the registrations
const SAME_SECOND = 60;      // other users' containers created in the same second: pinged too, by design (shared key)
const EXPIRED = 40;          // in the window but expired: never pinged
const EXPLICIT = 20;         // in the window but named, not `auto`: never pinged
const OLDER = 300;           // created minutes before any registration: never pinged, and where paging must stop
const IN_WINDOW = OURS + SAME_SECOND + EXPIRED + EXPLICIT;

// the keeper's cadence and page size (see the consts in openai.companion-containerKeepAlive.ts)
const FIRST_TICK_MS = 60_000;
const LIST_PAGE = 100;

const ACCESS = { dialect: 'openai', oaiKey: 'test-key', oaiOrg: '', oaiHost: 'http://containers.test' } as const;


type MockContainer = { id: string; name: string; status: string; created_at: number };

function mockPopulation(nowSeconds: number): MockContainer[] {
  const data: MockContainer[] = [];
  for (let i = 0; i < OURS; i++) data.push({ id: `cntr_ours_${i}`, name: 'auto', status: 'running', created_at: nowSeconds + (i % 3) });
  for (let i = 0; i < SAME_SECOND; i++) data.push({ id: `cntr_same_${i}`, name: 'auto', status: 'running', created_at: nowSeconds + 1 });
  for (let i = 0; i < EXPIRED; i++) data.push({ id: `cntr_expired_${i}`, name: 'auto', status: 'expired', created_at: nowSeconds });
  for (let i = 0; i < EXPLICIT; i++) data.push({ id: `cntr_named_${i}`, name: 'my-container', status: 'running', created_at: nowSeconds });
  for (let i = 0; i < OLDER; i++) data.push({ id: `cntr_old_${i}`, name: 'auto', status: 'running', created_at: nowSeconds - 400 - i });
  return data.sort((a, b) => b.created_at - a.created_at);
}


// what the Containers API saw
let population: MockContainer[] = [];
const listCalls: string[] = [];
const pings = new Map<string, number>();
let requests = 0;

/** The Containers API, in memory: `GET /v1/containers?limit=&order=desc&after=` pages newest first; `GET /v1/containers/{id}` is a ping */
async function containersApi(input: string | URL | Request): Promise<Response> {
  requests++;
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.pathname === '/v1/containers') {
    listCalls.push(url.search);
    const limit = Number(url.searchParams.get('limit') || 20);
    const afterId = url.searchParams.get('after');
    const start = afterId ? population.findIndex(container => container.id === afterId) + 1 : 0;
    const page = population.slice(start, start + limit);
    return Response.json({ object: 'list', data: page, first_id: page[0]?.id, last_id: page[page.length - 1]?.id, has_more: start + limit < population.length });
  }
  const single = url.pathname.match(/^\/v1\/containers\/(.+)$/);
  if (!single) return Response.json({}, { status: 404 });
  pings.set(single[1], (pings.get(single[1]) || 0) + 1);
  return Response.json({ id: single[1], status: 'running' });
}

/** The mocked clock fires the keeper's timer; its listing and pings then run as promise chains on the real event loop: wait until they go quiet */
async function settled(): Promise<void> {
  for (let quietTurns = 0, seen = requests; quietTurns < 25; quietTurns++, seen = requests) {
    await new Promise(resolve => setImmediate(resolve));
    if (requests !== seen) quietTurns = 0;
  }
}

const pingedWithPrefix = (prefix: string) => [...pings.keys()].filter(id => id.startsWith(prefix)).length;


before(() => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-01-01T00:00:00Z') });
  mock.method(globalThis, 'fetch', containersApi);
  // the keeper narrates every registration and tick in development
  mock.method(console, 'log', () => {});
  mock.method(console, 'warn', () => {});
});

after(() => {
  mock.timers.reset();
  mock.restoreAll();
});


describe('OpenAI container keep-alive: 100 dispatches, one shared tick', () => {

  const companions: ReturnType<typeof OpenAIContainerKeepAlive.companion>[] = [];
  const register = (count: number) => {
    for (let i = 0; i < count; i++) {
      const companion = OpenAIContainerKeepAlive.companion(ACCESS);
      companion.onStart?.(new AbortController().signal);
      companions.push(companion);
    }
  };

  // 100 registrations staggered over 20 s, then past the first tick, which comes 60 s after the first registration
  before(async () => {
    population = mockPopulation(Math.floor(Date.now() / 1000));
    register(50);
    mock.timers.tick(2_000);
    register(30);
    mock.timers.tick(18_000);
    register(20);
    mock.timers.tick(FIRST_TICK_MS - 20_000 + 5_000);
    await settled();
  });

  after(() => companions.forEach(companion => companion.onEnd?.()));

  test('lists in pages, newest first, and stops at the page that reaches past the oldest registration', () => {
    // the containers in the window fill three pages and part of the fourth, which ends on older ones
    assert.equal(listCalls.length, Math.floor(IN_WINDOW / LIST_PAGE) + 1, JSON.stringify(listCalls));
    assert.ok(listCalls.every(query => query.includes('order=desc')), JSON.stringify(listCalls));
  });

  test('pings every container of ours, and the same-second neighbors too', () => {
    assert.equal(pingedWithPrefix('cntr_ours_'), OURS);
    assert.equal(pingedWithPrefix('cntr_same_'), SAME_SECOND);
  });

  test('never pings an expired, an explicit or an older container', () => {
    assert.deepEqual([pingedWithPrefix('cntr_expired_'), pingedWithPrefix('cntr_named_'), pingedWithPrefix('cntr_old_')], [0, 0, 0]);
  });

  test('pings each target once per tick, whatever the number of dispatches', () => {
    assert.deepEqual([...new Set(pings.values())], [1]);
  });

});


describe('OpenAI container keep-alive: aborted before the first tick', () => {

  // 20 registrations aborted 5 s in, then past the time of their first tick
  before(async () => {
    listCalls.length = 0;
    pings.clear();
    const controllers = Array.from({ length: 20 }, () => new AbortController());
    for (const controller of controllers)
      OpenAIContainerKeepAlive.companion(ACCESS).onStart?.(controller.signal);
    mock.timers.tick(5_000);
    for (const controller of controllers) controller.abort();
    mock.timers.tick(FIRST_TICK_MS + 2_000);
    await settled();
  });

  test('nothing is listed and nothing is pinged', () => {
    assert.deepEqual([listCalls.length, pings.size], [0, 0]);
  });

});
