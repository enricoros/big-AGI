// The HTTP pieces every part of the simulator shares. Nothing here knows a vendor or a defect.

export const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-expose-headers': '*' };

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/** The parsed JSON of a body, or {} when it is not JSON */
export function parseJson(buffer) {
  try { return JSON.parse(buffer.toString('utf8')); } catch { return {}; }
}

/** One whole response; `body` is sent as is when it is a string, else as JSON */
export function send(res, status, body, headers = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': typeof body === 'string' ? 'text/plain' : 'application/json', ...CORS, ...headers });
  res.end(text);
}

/**
 * Resolves with the port once listening; port 0 takes any free one. No host: both IPv4 and IPv6, as `localhost` may be either.
 * @param {import('node:http').Server} server
 * @param {number} [port]
 * @param {string} [host]
 * @returns {Promise<number>}
 */
export function listen(server, port = 0, host = undefined) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server.address().port));
  });
}

/** Resets the connection: the other side reads a dropped socket, not an end */
export function resetSocket(req) {
  if (req.socket.resetAndDestroy) req.socket.resetAndDestroy();
  else req.socket.destroy();
}
