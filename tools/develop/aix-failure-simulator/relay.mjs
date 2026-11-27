// The simulator's relay: a proxy in front of the app's own server that breaks the relay hop on demand.
// Open the app on the relay's port: everything passes (pages, chunks, HMR websockets) until a fault is armed.
//
//   node tools/develop/aix-failure-simulator/relay.mjs [port=3405] [app=http://localhost:3000]
//   GET /__sim                                         the state
//   GET /__sim?fault=<spec>[&count=1][&ctx=conversation]    arm; fault=none disarms
//
// A fault hits the next AIX generation call (POST /api/edge/aix.chatGenerateContent, streaming or not) whose context
// name is `ctx`, `count` times, then disarms. `ctx=*` takes any call: titles, Beam rays.
//
//   the shared defects (lib/defects.mjs), a chunk being one line of the tRPC stream:
//     http<status>   that status with the plain-text body a platform sends (413 from a body limit, 502 from a gateway)
//     refuse, html, cut<N>, reset<N>, stall<N>, slow<ms>, garbage<N>
//   the relay's own:
//     json<status>   that status with a JSON body that is no tRPC envelope
//     badinput       forwards the call without its `access`: the real server rejects it (a real tRPC BAD_REQUEST)
//     noend          drops the line that carries the end particle: a complete tRPC stream with no AIX end
//     badparticle    replaces the first text particle with an issue particle that has no record: a particle the client cannot place
//     down           resets EVERY request (pages, chunks, API) until fault=none: the server is unreachable
//
// The browser pass (browser/runner.js, browser/cases.json): open /__sim/browser in any browser, and the app's page runs
// the cases by itself and reports here. /__sim/browser?only=relay or ?only=direct for one phase; GET /__sim/report: the rows.
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CORS, listen, readBody, resetSocket, send, sleep } from './lib/http.mjs';
import { applyBefore, chunkOf, DEFECT_KINDS, duringAction, endWith, parseDefect } from './lib/defects.mjs';

const BROWSER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'browser');
const GENERATION_PATH = '/api/edge/aix.chatGenerateContent';
const OWN_FAULTS = ['json<status>', 'badinput', 'noend', 'badparticle', 'down'];
const OWN = /^(?:json(\d+)|badinput|noend|badparticle|down)$/;

/** A fault as armed: one of the relay's own, or a shared defect. Throws on a spec it cannot read */
function parseFault(spec) {
  const own = OWN.exec(spec);
  if (own) return { spec, own: own[1] ? 'json' : spec, ...(own[1] && { status: Number(own[1]) }) };
  return { spec, defect: parseDefect(spec) };
}

/** The AIX context name of a batch-stream call body: {"0":{"json":{...,"context":{"method":"chat-generate","name":"conversation",...}}}} */
function contextNameOf(body) {
  try {
    const input = JSON.parse(body.toString('utf8'))?.['0'];
    return (input?.json ?? input)?.context?.name;
  } catch {
    return undefined;
  }
}

/** The call without its `access`: what a client sends when its input is not what the server validates */
function withoutAccess(body) {
  try {
    const parsed = JSON.parse(body.toString('utf8'));
    delete (parsed['0']?.json ?? parsed['0']).access;
    return Buffer.from(JSON.stringify(parsed));
  } catch {
    return Buffer.from('{"0":{"json":{}}}');
  }
}

export async function startRelay({ port = 3405, app = 'http://localhost:3000', log = console.log } = {}) {
  const target = new URL(app);
  const state = { fault: null, left: 0, ctx: 'conversation', applied: 0 };
  const pass = { active: false, reported: 0, report: null }; // the browser pass

  /**
   * Forwards a request to the app. With `lines`, the response is taken line by line (the tRPC batch stream is JSONL):
   * { defect?, map?(line) -> line or '' } says what becomes of each. With `html`, an HTML page is rewritten by it.
   */
  function forward(req, res, { body = undefined, lines = undefined, html = undefined } = {}) {
    const headers = { ...req.headers };
    if (body) { headers['content-length'] = String(body.length); delete headers['transfer-encoding']; }
    if (html) headers['accept-encoding'] = 'identity';
    const upstream = http.request({ host: target.hostname, port: target.port, method: req.method, path: req.url, headers }, (up) => {
      if (html && String(up.headers['content-type'] || '').includes('text/html')) {
        const chunks = [];
        up.on('data', chunk => chunks.push(chunk));
        up.on('end', () => {
          const page = html(Buffer.concat(chunks).toString('utf8'));
          const { 'content-length': _length, 'transfer-encoding': _transfer, 'content-encoding': _encoding, ...rest } = up.headers;
          res.writeHead(up.statusCode || 200, { ...rest, 'content-length': Buffer.byteLength(page) });
          res.end(page);
        });
        return up.on('error', () => res.destroy());
      }
      res.writeHead(up.statusCode || 502, up.headers);
      if (!lines) return up.pipe(res);

      let pending = '', index = 0, stopped = false, writing = Promise.resolve();
      const write = (line) => writing = writing.then(async () => {
        if (stopped || res.destroyed) return;
        const action = duringAction(lines.defect, index);
        if (action !== 'send') {
          stopped = true;
          upstream.destroy();
          return endWith(action, req, res);
        }
        const out = lines.map ? lines.map(line) : line;
        if (out) res.write(chunkOf(lines.defect, index, out));
        index++;
        if (lines.defect?.pace) await sleep(lines.defect.pace);
      });
      up.setEncoding('utf8');
      up.on('data', (text) => {
        pending += text;
        for (let at = pending.indexOf('\n'); at >= 0; at = pending.indexOf('\n')) {
          write(pending.slice(0, at + 1));
          pending = pending.slice(at + 1);
        }
      });
      up.on('end', () => writing.then(() => { if (!stopped) res.end(pending); }));
      up.on('error', () => { if (!stopped) res.destroy(); });
    });
    upstream.on('error', (error) => {
      if (res.headersSent) return res.destroy();
      send(res, 502, `aix-failure-simulator relay: the app at ${target.host} is unreachable: ${error.code || error.message}`);
    });
    res.on('close', () => upstream.destroy()); // the browser went away (a Stop): the server must see it
    if (body) upstream.end(body);
    else req.pipe(upstream);
  }

  function control(url, res) {
    const spec = url.searchParams.get('fault');
    if (spec === 'none') Object.assign(state, { fault: null, left: 0 });
    else if (spec !== null) {
      try {
        state.fault = parseFault(spec);
      } catch (error) {
        return send(res, 400, { error: error.message, faults: [...DEFECT_KINDS, ...OWN_FAULTS] }, CORS);
      }
      state.left = Number(url.searchParams.get('count') || (state.fault.own === 'down' ? Infinity : 1));
      state.ctx = url.searchParams.get('ctx') || 'conversation';
      log(`[relay] armed ${spec} x${state.left} ctx=${state.ctx}`);
    }
    return send(res, 200, { fault: state.fault?.spec ?? 'none', left: Number.isFinite(state.left) ? state.left : 'until none', ctx: state.ctx, applied: state.applied, faults: [...DEFECT_KINDS, ...OWN_FAULTS] }, CORS);
  }

  /** The browser pass: its start page, its script and cases, and the report the page posts after every case */
  async function browserPass(req, res, url) {
    const noStore = { 'cache-control': 'no-store' };
    switch (url.pathname) {
      case '/__sim/browser': {
        Object.assign(pass, { active: true, reported: 0, report: null });
        const start = { phase: 'start', only: url.searchParams.get('only') || undefined, index: 0, results: [] };
        log(`[relay] browser pass started${start.only ? ` (${start.only} only)` : ''}`);
        return send(res, 200, `<!doctype html><meta charset="utf-8"><title>simulator</title><body style="font:14px sans-serif;padding:24px">Starting the browser pass...
<script>localStorage.setItem('__sim_pass', ${JSON.stringify(JSON.stringify(start))}); location.replace('/');</script>`, { 'content-type': 'text/html; charset=utf-8', ...noStore });
      }
      case '/__sim/runner.js':
        return send(res, 200, fs.readFileSync(path.join(BROWSER, 'runner.js'), 'utf8'), { 'content-type': 'text/javascript; charset=utf-8', ...noStore });
      case '/__sim/cases':
        return send(res, 200, JSON.parse(fs.readFileSync(path.join(BROWSER, 'cases.json'), 'utf8')), noStore);
      case '/__sim/report': {
        if (req.method !== 'POST') return send(res, 200, pass.report ?? { results: [] }, noStore);
        try { pass.report = JSON.parse((await readBody(req)).toString('utf8')); } catch { return send(res, 400, 'not JSON'); }
        for (const row of pass.report.results.slice(pass.reported))
          log(`[relay] browser ${row.ok ? 'ok  ' : 'DIFF'} ${row.name}: ${row.error ?? row.got}${row.ok ? '' : `   (expected ${row.expect})`}`);
        pass.reported = pass.report.results.length;
        if (pass.report.done)
          log(`[relay] browser pass done: ${pass.report.results.filter(row => row.ok).length} of ${pass.reported} as expected`);
        return send(res, 200, 'ok');
      }
    }
    return send(res, 404, 'not found');
  }
  const withRunner = (page) => page.includes('</body>') ? page.replace('</body>', '<script src="/__sim/runner.js"></script></body>') : page + '<script src="/__sim/runner.js"></script>';

  /** The armed fault, consumed */
  function take() {
    const { fault } = state;
    state.applied++;
    if (--state.left <= 0) Object.assign(state, { fault: null, left: 0 });
    return fault;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://relay');
    if (url.pathname === '/__sim') return control(url, res);
    if (url.pathname.startsWith('/__sim/')) return browserPass(req, res, url);

    if (state.fault?.own === 'down') { state.applied++; return resetSocket(req); }
    if (pass.active && req.method === 'GET' && url.pathname === '/') {
      if (pass.report?.done) pass.active = false; // the page's last load: it shows the result, with the settings put back
      return forward(req, res, { html: withRunner });
    }
    if (!state.fault || req.method !== 'POST' || !url.pathname.startsWith(GENERATION_PATH)) return forward(req, res);

    const body = await readBody(req);
    const ctx = contextNameOf(body);
    if (state.ctx !== '*' && ctx !== state.ctx) return forward(req, res, { body });

    const fault = take();
    log(`[relay] ${fault.spec} on a '${ctx}' generation`);
    switch (fault.own) {
      case 'json':
        return send(res, fault.status, { error: 'bad_gateway', message: 'The upstream server is unavailable.' });
      case 'badinput':
        return forward(req, res, { body: withoutAccess(body) });
      case 'noend':
        return forward(req, res, { body, lines: { map: (line) => line.includes('"cg":"end"') ? '' : line } });
      case 'badparticle': {
        let done = false;
        return forward(req, res, { body, lines: { map: (line) => (!done && /\{"t":"/.test(line)) ? (done = true, line.replace(/\{"t":"(?:[^"\\]|\\.)*"\}/, '{"cg":"aix-issue"}')) : line } });
      }
    }
    const { defect } = fault;
    if (defect.before) // a relay fault takes every request it is armed for: `count` says how many
      return applyBefore(req, res, defect.before, (status) => ({ body: http.STATUS_CODES[status] ?? 'Error' }));
    return forward(req, res, { body, lines: { defect } });
  });

  // websockets (Next HMR): a raw tunnel
  server.on('upgrade', (req, socket, head) => {
    if (state.fault?.own === 'down') return socket.destroy();
    const upstream = net.connect(Number(target.port), target.hostname, () => {
      upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` + Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
      if (head?.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  });

  const listening = await listen(server, port);
  return { port: listening, url: `http://localhost:${listening}`, close: () => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); }) };
}

// no top-level await: the driver loads the simulator's modules through tsx, which compiles them to CommonJS
if (import.meta.url === `file://${process.argv[1]}`)
  startRelay({ port: Number(process.argv[2] || 3405), app: process.argv[3] || 'http://localhost:3000' }).then(relay =>
    console.log(`[relay] ${relay.url} -> ${process.argv[3] || 'http://localhost:3000'}   open the app here; arm with ${relay.url}/__sim?fault=<spec>`));
