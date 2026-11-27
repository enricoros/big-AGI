// The simulator for a browser, in one command: the service, the app's dev server and the relay in front of it.
//
//   node tools/develop/aix-failure-simulator/start.mjs                           starts the app's dev server too, on a free port
//   node tools/develop/aix-failure-simulator/start.mjs --app http://localhost:3000    uses one that already runs
//   options: --service-port 8791   --relay-port 3405
//
// Then open the relay's URL (one tab: the app is single-instance per origin), and add the services it prints.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listen, sleep } from './lib/http.mjs';
import { startRelay } from './relay.mjs';
import { startService } from './service.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const option = (name, fallback) => { const at = process.argv.indexOf(name); return at < 0 ? fallback : process.argv[at + 1]; };

async function freePort() {
  const probe = http.createServer();
  const port = await listen(probe, 0);
  await new Promise(resolve => probe.close(resolve));
  return port;
}

async function startApp() {
  const port = await freePort();
  // resolved as Node resolves it, so a worktree that borrows a parent's node_modules works too
  const next = createRequire(path.join(REPO, 'package.json')).resolve('next/dist/bin/next');
  const child = spawn(process.execPath, [next, 'dev', REPO, '-p', String(port)], { stdio: ['ignore', 'inherit', 'inherit'], detached: true });
  // its own process group, stopped as one: `next dev` runs the server in a child of its own
  process.on('exit', () => { try { process.kill(-child.pid); } catch { /* gone already */ } });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0));
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 120; i++) { // the first page compiles on demand
    if (await fetch(url, { signal: AbortSignal.timeout(60_000) }).then(response => response.ok, () => false)) return url;
    await sleep(1000);
  }
  throw new Error(`the app's dev server did not answer at ${url}`);
}

const service = await startService({ port: Number(option('--service-port', 8791)) });
const app = option('--app') ?? await startApp();
const relay = await startRelay({ port: Number(option('--relay-port', 3405)), app });

console.log(`
AIX failure simulator

  Open            ${relay.url}        (the app, through the relay; one tab only)
  Add services    OpenAI, Anthropic, Gemini: API host ${service.url}, then any key. The host FIRST:
                  a key typed before the host is sent to the real vendor.
  Pick a model    'Sim: <scenario>' - a capture, a hand-built answer, or 'ok ~ <defect>'
  Break the relay ${relay.url}/__sim?fault=cut8        (http413, http502, html, refuse, reset8, noend, down ...)
  Break a vendor  ${service.url}/__sim?defect=reset4   (for the next request; or pick an 'ok ~ <defect>' model)
`);
