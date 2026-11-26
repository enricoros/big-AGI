// Mock AI service for failure scenarios. One host; the scenario is the model id ("mock-<scenario>").
// OpenAI Chat Completions grammar at /v1/chat/completions, model list at /v1/models. CORS open, for Direct Connection.
// Usage: node tools/develop/aix-issues-lab/mock-service.mjs [port]      (default 8791)
import http from 'node:http';

export const SCENARIOS = [
  'ok', 'length', 'no-finish', 'empty',
  'http401', 'http402', 'http403', 'http404', 'http413', 'http429', 'http500', 'http503',
  'html', 'rst-pre', 'rst-mid', 'cut-mid', 'stream-error', 'stream-error-first', 'filter', 'garbage', 'late-error', 'slow',
];

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-expose-headers': '*' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function chunk(model, delta, finish = null, extra = {}) {
  return `data: ${JSON.stringify({ id: 'chatcmpl-mock', object: 'chat.completion.chunk', created: 1700000000, model, choices: [{ index: 0, delta, finish_reason: finish }], ...extra })}\n\n`;
}

function jsonError(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', ...CORS, ...headers });
  res.end(JSON.stringify(body));
}

const WORDS = 'The quick brown fox jumps over the lazy dog, twice, then rests under the old oak tree.'.split(' ');

async function chat(req, res, body) {
  const model = String(body.model || 'mock-ok');
  const scenario = model.replace(/^mock-/, '');
  const streaming = body.stream !== false;
  const hits = (chat.hits[scenario] = (chat.hits[scenario] || 0) + 1);
  console.log(`[mock-service] chat ${scenario} stream=${streaming} hit=${hits}`);

  switch (scenario) {
    case 'http401': return jsonError(res, 401, { error: { message: 'Incorrect API key provided: sk-mock. You can find your API key at https://platform.example.com/account/api-keys.', type: 'invalid_request_error', param: null, code: 'invalid_api_key' } });
    case 'http402': return jsonError(res, 402, { error: { message: 'Insufficient credits. Add more using https://example.com/settings/credits', code: 402 } });
    case 'http403': return jsonError(res, 403, { error: { message: 'Country, region, or territory not supported', type: 'request_forbidden', code: 'unsupported_country_region_territory' } });
    case 'http404': return jsonError(res, 404, { error: { message: `The model \`${model}\` does not exist or you do not have access to it.`, type: 'invalid_request_error', param: null, code: 'model_not_found' } });
    case 'http413': res.writeHead(413, { 'content-type': 'text/plain', ...CORS }); return res.end('Request Entity Too Large');
    case 'http429': return jsonError(res, 429, { error: { message: 'Rate limit reached for mock-model in organization org-mock on requests per min (RPM): Limit 3, Used 3, Requested 1. Please try again in 20s.', type: 'requests', param: null, code: 'rate_limit_exceeded' } }, { 'retry-after': '1' });
    case 'http500': return jsonError(res, 500, { error: { message: 'The server had an error while processing your request. Sorry about that!', type: 'server_error', param: null, code: null } });
    case 'http503': return jsonError(res, 503, { error: { message: 'The engine is currently overloaded, please try again later', type: 'service_unavailable', code: 'overloaded' } });
    case 'html': res.writeHead(200, { 'content-type': 'text/html', ...CORS }); return res.end('<!DOCTYPE html><html><body>Sign in to the network</body></html>');
    case 'rst-pre': return req.socket.resetAndDestroy();
    default: break;
  }

  if (!streaming) {
    const finish = scenario === 'length' ? 'length' : scenario === 'filter' ? 'content_filter' : 'stop';
    return jsonError(res, 200, { id: 'chatcmpl-mock', object: 'chat.completion', created: 1700000000, model, choices: [{ index: 0, message: { role: 'assistant', content: WORDS.join(' ') }, finish_reason: finish }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } });
  }

  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', ...CORS });
  const say = async (n, from = 0) => {
    for (let i = from; i < from + n && i < WORDS.length; i++) {
      res.write(chunk(model, i === 0 ? { role: 'assistant', content: WORDS[i] } : { content: ' ' + WORDS[i] }));
      await sleep(40);
    }
  };
  const finish = (reason) => res.write(chunk(model, {}, reason, { usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } }));
  const done = () => res.end('data: [DONE]\n\n');
  const errorChunk = () => res.write(`data: ${JSON.stringify({ error: { message: 'The server had an error while processing your request. Sorry about that!', type: 'server_error', param: null, code: 'server_error' } })}\n\n`);

  switch (scenario) {
    case 'ok': await say(99); finish('stop'); return done();
    case 'length': await say(6); finish('length'); return done();
    case 'no-finish': await say(6); return done();
    case 'empty': return done();
    case 'rst-mid': await say(4); await sleep(50); return req.socket.resetAndDestroy();
    case 'cut-mid': await say(4); return res.end();
    case 'stream-error': await say(4); errorChunk(); return done();
    case 'stream-error-first': errorChunk(); return done();
    case 'filter': await say(4); finish('content_filter'); return done();
    case 'garbage': await say(4); res.write('data: {"id": "chatcmpl-mock", "choices": [{"index": 0, "delta": {"content": 42}}]}\n\n'); res.write('data: {not json\n\n'); return done();
    case 'late-error': await say(99); finish('stop'); await sleep(50); errorChunk(); return done();
    case 'slow': for (let i = 0; i < 120 && !res.destroyed; i++) { res.write(chunk(model, { content: (i ? ' ' : '') + 'tick' + i })); await sleep(1000); } finish('stop'); return done();
    default: await say(99); finish('stop'); return done();
  }
}
chat.hits = {};

export function startMockService(port = 8791) {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
      const url = new URL(req.url, 'http://x');
      if (req.method === 'GET' && url.pathname.endsWith('/models')) {
        return jsonError(res, 200, { object: 'list', data: SCENARIOS.map(s => ({ id: `mock-${s}`, object: 'model', created: 1700000000, owned_by: 'mock' })) });
      }
      if (req.method === 'POST' && url.pathname.endsWith('/chat/completions')) {
        let raw = '';
        for await (const c of req) raw += c;
        let body = {};
        try { body = JSON.parse(raw); } catch { /* scenario ok */ }
        return await chat(req, res, body);
      }
      res.writeHead(404, CORS); res.end('not found');
    } catch (error) {
      console.log('[mock-service] handler error', error?.message);
      try { res.destroy(); } catch { /* ignore */ }
    }
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] || 8791);
  await startMockService(port);
  console.log(`[mock-service] http://127.0.0.1:${port}/v1  scenarios: ${SCENARIOS.join(', ')}`);
}
