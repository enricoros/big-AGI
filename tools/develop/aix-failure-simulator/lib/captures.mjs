// The capture corpus (tools/data/aix-replay/generations) as scenarios: every recorded vendor answer can be served again.
// A scenario's name is the capture's file name without its extension, its `_nonstream` mark and its part suffix:
//   haiku-5.5_pause-turn-stream_1-initial.sse + _2-continuation.sse   ->   'haiku-5.5_pause-turn-stream', two parts
// Parts are the answers of one paused turn: request 1 gets part 1, request 2 gets part 2, then the cycle repeats.
import fs from 'node:fs';
import path from 'node:path';

const PART = /_(\d)-(?:initial|continuation)$/;

/** Map<vendor, Map<name, { vendor, name, sse: string[], json: string[] }>>: file paths, by part */
export function indexCaptures(root) {
  const byVendor = new Map();
  if (!fs.existsSync(root)) return byVendor;
  for (const vendor of fs.readdirSync(root).sort()) {
    const dir = path.join(root, vendor);
    if (!fs.statSync(dir).isDirectory()) continue;
    const entries = new Map();
    for (const file of fs.readdirSync(dir).sort()) {
      if (file.endsWith('.req.json')) continue; // the request that produced a capture, not an answer
      const kind = file.endsWith('.sse') ? 'sse' : file.endsWith('.json') ? 'json' : null;
      if (!kind) continue;
      let name = file.slice(0, -(kind.length + 1)).replace(/_nonstream$/, '');
      const part = PART.exec(name);
      if (part) name = name.slice(0, part.index).replace(/_nonstream$/, '');
      const entry = entries.get(name) ?? { vendor, name, sse: [], json: [] };
      entry[kind][part ? Number(part[1]) - 1 : 0] = path.join(dir, file);
      entries.set(name, entry);
    }
    byVendor.set(vendor, entries);
  }
  return byVendor;
}

/** The SSE events of a body, byte for byte: joined, they are the body again (Gemini's CRLF included) */
export function sseEvents(text) {
  return text.match(/[\s\S]*?(?:\r?\n\r?\n|$)/g).filter(Boolean);
}

/** The answer a capture gives to request number `hit` (from 1), or null when it has none in that mode */
export function capturePlan(entry, { streaming, hit }) {
  const files = (streaming ? entry.sse : entry.json).filter(Boolean);
  if (!files.length) return null;
  const text = fs.readFileSync(files[(hit - 1) % files.length], 'utf8');
  if (!streaming) return { stream: false, chunks: [text] };
  const chunks = sseEvents(text);
  return { stream: true, chunks, pace: Math.max(1, Math.min(20, Math.floor(2500 / chunks.length))) }; // a long capture plays in about 2.5s
}
