// One defect vocabulary for both hops: the service applies it to a vendor's answer, the relay to our own server's.
// A defect is what the transport does; what the answer says is the scenario's.
//
//   before the response   http<status>   answers with that status; the hop supplies the body its kind of server sends
//                         refuse         resets the socket before any response
//                         html           a 200 HTML page: a Wi-Fi sign-in page, a gateway
//   during the body       cut<N>         ends the body cleanly after N chunks
//                         reset<N>       resets the socket after N chunks
//                         stall<N>       after N chunks sends nothing more and keeps the connection open
//                         garbage<N>     replaces chunk N with one that is not JSON
//                         slow<ms>       waits <ms> between chunks
//
//   x<K> on a 'before' defect: K requests in a row get it, the next one passes, and the cycle repeats
//        (http429x2: fail, fail, pass, fail, fail, pass). Without it every request gets it.
//   '+' joins: http503x1+slow200
//
// A chunk is one SSE event on the vendor hop, one JSONL line on the relay hop.
import { resetSocket, send, sleep } from './http.mjs';

export const DEFECT_KINDS = ['http<status>', 'refuse', 'html', 'cut<N>', 'reset<N>', 'stall<N>', 'garbage<N>', 'slow<ms>'];

const PART = /^(http|refuse|html|cut|reset|stall|garbage|slow)(\d+)?(?:x(\d+))?$/;
const HTML_PAGE = '<!DOCTYPE html><html><head><title>Sign in</title></head><body>Sign in to the network to continue.</body></html>';

/** Throws on a spec it cannot read: a typo must not run as "no defect" */
export function parseDefect(spec) {
  const defect = { spec };
  for (const part of String(spec).split('+')) {
    const match = PART.exec(part);
    if (!match) throw new Error(`unknown defect '${part}' (${DEFECT_KINDS.join(', ')})`);
    const [, kind, number, times] = match;
    const n = number === undefined ? undefined : Number(number);
    switch (kind) {
      case 'http':
        if (!n) throw new Error(`defect 'http' needs a status: http503`);
        defect.before = { kind, status: n, times: Number(times || 0) };
        break;
      case 'refuse': case 'html':
        defect.before = { kind, times: Number(times || 0) };
        break;
      case 'cut': case 'reset': case 'stall':
        defect.during = { kind, after: n ?? 4 };
        break;
      case 'garbage':
        defect.garbageAt = n ?? 2;
        break;
      case 'slow':
        defect.pace = n ?? 1000;
        break;
    }
  }
  return defect;
}

/** Whether the 'before' defect takes this request; `hit` counts the requests of one kind from 1 */
export function beforeApplies(defect, hit) {
  const before = defect?.before;
  if (!before) return false;
  return !before.times || (hit - 1) % (before.times + 1) < before.times;
}

/**
 * Answers with the 'before' defect. `errorOf(status)` gives what this hop's server sends for a status:
 * { body, headers? }, the body a string (plain text) or an object (JSON).
 */
export function applyBefore(req, res, before, errorOf) {
  switch (before.kind) {
    case 'refuse':
      return resetSocket(req);
    case 'html':
      return send(res, 200, HTML_PAGE, { 'content-type': 'text/html; charset=utf-8' });
    case 'http': {
      const { body, headers } = errorOf(before.status);
      return send(res, before.status, body, headers);
    }
  }
}

/** What to do with chunk `index` (from 0): 'send', or the 'during' defect that starts there */
export function duringAction(defect, index) {
  return defect?.during && index === defect.during.after ? defect.during.kind : 'send';
}

/** The chunk as sent: itself, or not JSON when the defect replaces it */
export function chunkOf(defect, index, chunk) {
  if (defect?.garbageAt !== index) return chunk;
  return /^(event|data):/m.test(chunk) ? 'data: {not json\n\n' : '{not json\n';
}

/** Ends a response the way a 'during' defect says; a stall leaves it open */
export async function endWith(kind, req, res) {
  if (kind === 'cut') return void res.end();
  if (kind === 'reset') {
    await sleep(50); // let what was written leave first
    return resetSocket(req);
  }
}

/**
 * A body of known chunks with the defect applied. `hang`: a body that never ends by itself.
 * A defect placed past the end of a short body lands on its last chunk: it always does something.
 */
export async function sendChunks(req, res, chunks, { pace = 0, defect = undefined, hang = false } = {}) {
  const wait = defect?.pace ?? pace, last = chunks.length - 1;
  const placed = defect && { ...defect, ...(defect.during && { during: { ...defect.during, after: Math.min(defect.during.after, last) } }), ...(defect.garbageAt !== undefined && { garbageAt: Math.min(defect.garbageAt, last) }) };
  for (let index = 0; index < chunks.length; index++) {
    if (res.destroyed) return;
    const action = duringAction(placed, index);
    if (action !== 'send') return endWith(action, req, res);
    res.write(chunkOf(placed, index, chunks[index]));
    if (wait) await sleep(wait);
  }
  if (!hang) res.end();
}
