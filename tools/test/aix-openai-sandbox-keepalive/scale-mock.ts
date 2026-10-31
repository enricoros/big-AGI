/**
 * Scale test of the OpenAI sandbox keep-alive (openai.companion-containerKeepAlive.ts) against a mock Containers API. No network, no key.
 *
 * Why: the keeper's discovery is a time-windowed, paginated listing of the newest containers, deduplicated across every live
 * registration and pinged through a small pool. Running 100 real pro-mode rays costs hundreds of dollars; this exercises the
 * same code path with 100 staggered registrations against a local listing that mixes our containers with same-second neighbors,
 * expired and explicit ones, and older ones, then checks that the abort exit stops everything before the first tick.
 *
 * Usage (about 2.5 minutes: the keeper's first tick comes 60 s after the first registration):
 *   NODE_ENV=development npx tsx tools/test/aix-openai-sandbox-keepalive/scale-mock.ts
 *
 * Exit code 0 when every expectation holds, 1 otherwise. NODE_ENV=development also prints the keeper's own debug lines.
 */
import http from 'node:http';

import { OpenAIContainerKeepAlive } from '~/modules/aix/server/dispatch/chatGenerate/adapters/openai.companion-containerKeepAlive';


// the mock population: what a listing returns, newest first
const OURS = 200;            // 100 pro-mode rays, two containers each, created in the same seconds as the registrations
const SAME_SECOND = 60;      // other users' containers created in the same second: pinged too, by design (shared key)
const EXPIRED = 40;          // in the window but expired: never pinged
const EXPLICIT = 20;         // in the window but named, not `auto`: never pinged
const OLDER = 300;           // created minutes before any registration: never pinged, and where paging must stop

// the keeper's cadence (see the consts in openai.companion-containerKeepAlive.ts)
const FIRST_TICK_MS = 60_000;


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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const data = mockPopulation(Math.floor(Date.now() / 1000));
  const listCalls: string[] = [];
  const pings = new Map<string, number>();

  // the mock Containers API: `GET /v1/containers?limit=&order=desc&after=` pages newest first; `GET /v1/containers/{id}` is a ping
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://mock');
    res.setHeader('content-type', 'application/json');
    if (url.pathname === '/v1/containers') {
      listCalls.push(url.search);
      const limit = Number(url.searchParams.get('limit') || 20);
      const after = url.searchParams.get('after');
      const start = after ? data.findIndex(c => c.id === after) + 1 : 0;
      const page = data.slice(start, start + limit);
      res.end(JSON.stringify({ object: 'list', data: page, first_id: page[0]?.id, last_id: page[page.length - 1]?.id, has_more: start + limit < data.length }));
      return;
    }
    const single = url.pathname.match(/^\/v1\/containers\/(.+)$/);
    if (single) {
      pings.set(single[1], (pings.get(single[1]) || 0) + 1);
      res.end(JSON.stringify({ id: single[1], status: 'running' }));
      return;
    }
    res.statusCode = 404;
    res.end('{}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const access = { dialect: 'openai' as const, oaiKey: 'test-key', oaiOrg: '', oaiHost: `http://127.0.0.1:${port}` };

  const failures: string[] = [];
  const expect = (condition: boolean, text: string) => {
    console.log(`${condition ? 'ok  ' : 'FAIL'} ${text}`);
    if (!condition) failures.push(text);
  };
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;

  // phase 1: 100 registrations, staggered over 20 s, one shared tick
  const companions: { companion: ReturnType<typeof OpenAIContainerKeepAlive.companion>; controller: AbortController }[] = [];
  const register = (count: number) => {
    for (let i = 0; i < count; i++) {
      const controller = new AbortController();
      const companion = OpenAIContainerKeepAlive.companion(access);
      companion.onStart?.(controller.signal);
      companions.push({ companion, controller });
    }
  };
  register(50);
  await sleep(2_000);
  register(30);
  await sleep(18_000);
  register(20);
  console.log(`[${elapsed()}] phase 1: 100 registrations live, waiting for the first tick`);
  await sleep(FIRST_TICK_MS - 20_000 + 5_000);

  const pingedIds = [...pings.keys()];
  const count = (prefix: string) => pingedIds.filter(id => id.startsWith(prefix)).length;
  expect(listCalls.length >= 3 && listCalls.length <= 5, `paginated listing: ${listCalls.length} pages for ${data.length} containers ${JSON.stringify(listCalls)}`);
  expect(count('cntr_ours_') === OURS, `discovered all of ours: ${count('cntr_ours_')}/${OURS}`);
  expect(count('cntr_same_') === SAME_SECOND, `pinged the same-second neighbors too, by design: ${count('cntr_same_')}/${SAME_SECOND}`);
  expect(count('cntr_expired_') === 0 && count('cntr_named_') === 0 && count('cntr_old_') === 0, `never pinged expired, explicit or older containers`);
  expect([...pings.values()].every(n => n === 1), `each target pinged once per tick (dedup across 100 registrations)`);
  for (const { companion } of companions) companion.onEnd?.();
  console.log(`[${elapsed()}] phase 1: released all 100`);

  // phase 2: 20 registrations aborted before their first tick: the abort exit releases them and the timer is cleared
  listCalls.length = 0;
  pings.clear();
  const controllers: AbortController[] = [];
  for (let i = 0; i < 20; i++) {
    const controller = new AbortController();
    OpenAIContainerKeepAlive.companion(access).onStart?.(controller.signal);
    controllers.push(controller);
  }
  await sleep(5_000);
  for (const controller of controllers) controller.abort();
  console.log(`[${elapsed()}] phase 2: 20 registrations aborted at +5 s, waiting past their first tick`);
  await sleep(FIRST_TICK_MS + 2_000);
  expect(listCalls.length === 0 && pings.size === 0, `no listing and no ping after the abort: ${listCalls.length} listings, ${pings.size} pings`);

  server.close();
  console.log(`[${elapsed()}] ${failures.length ? `${failures.length} expectation(s) failed` : 'all expectations hold'}`);
  process.exit(failures.length ? 1 : 0);
}

main().catch(error => {
  console.error('scale-mock failed:', error?.message || error);
  process.exit(1);
});
