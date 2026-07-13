// Anthropic API "eviscerate" harness - direct calls, streaming capture, agentic auto-resolve.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.join(HERE, '..', '..', '..');
export const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });

// key lookup: process.env, then repo-root .env.api-keys / .env.local / .env (never committed, never echoed)
export function apiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY.trim();
  for (const file of ['.env.api-keys', '.env.local', '.env']) {
    const p = path.join(REPO_ROOT, file);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, 'utf8').match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  throw new Error('ANTHROPIC_API_KEY not found (process.env or repo-root .env.api-keys / .env.local / .env)');
}

const API = 'https://api.anthropic.com/v1/messages';
export const MODEL = 'claude-opus-4-8';

// deterministic fake tool values so the model can reason (max/compare) over them
function hashNum(s, mod = 100) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h) % mod;
}
export function runClientTool(name, input) {
  if (name === 'get_weather') {
    const c = input.city || input.location || '?';
    return JSON.stringify({ city: c, temp_c: 5 + hashNum(c, 30), condition: ['sunny', 'cloudy', 'rain', 'snow'][hashNum(c, 4)] });
  }
  if (name === 'lookup_metric') {
    const e = input.entity || input.name || '?';
    return JSON.stringify({ entity: e, score: hashNum(e, 1000), unit: 'points' });
  }
  if (name === 'run_command') {
    return `Linux probe-host 6.8.0 x86_64 GNU/Linux  (fake result for: ${input.command})`;
  }
  return JSON.stringify({ ok: true, echo: input });
}

// ---- SSE streaming call. Returns { events, message, raw } ----
// message is the reconstructed final assistant message: { role, content, stop_reason, usage, container, id, model }
export async function callStream(body, { rawPath } = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey(),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!res.ok && res.headers.get('content-type')?.includes('application/json')) {
    const err = await res.json();
    return { httpStatus: res.status, error: err, events: [], message: null };
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const events = [];
  const rawLines = [];

  // reconstruction state
  const blocks = [];
  let message = { role: 'assistant', content: blocks };
  const partialJson = {}; // index -> string

  function handle(ev) {
    rawLines.push(JSON.stringify(ev));
    const t = ev.type;
    if (t === 'message_start') {
      const m = ev.message || {};
      message.id = m.id; message.model = m.model; message.usage = m.usage;
      if (m.container) message.container = m.container;
      events.push({ e: 'message_start', id: m.id, model: m.model });
    } else if (t === 'content_block_start') {
      const cb = ev.content_block;
      blocks[ev.index] = JSON.parse(JSON.stringify(cb));
      partialJson[ev.index] = '';
      const tag = cb.type + (cb.name ? `:${cb.name}` : '') + (cb.tool_use_id ? ` <-${cb.tool_use_id}` : '') + (cb.id ? ` id=${cb.id}` : '') + (cb.caller ? ` caller=${cb.caller.type}` : '');
      events.push({ e: 'block_start', i: ev.index, block: tag, full: cb });
    } else if (t === 'content_block_delta') {
      const d = ev.delta;
      if (d.type === 'input_json_delta') { partialJson[ev.index] += d.partial_json || ''; }
      else if (d.type === 'text_delta') { blocks[ev.index].text = (blocks[ev.index].text || '') + d.text; }
      else if (d.type === 'thinking_delta') { blocks[ev.index].thinking = (blocks[ev.index].thinking || '') + d.thinking; }
      else if (d.type === 'signature_delta') { blocks[ev.index].signature = d.signature; }
      // record deltas compactly (only note type + length) to keep event log readable
      const last = events[events.length - 1];
      if (last && last.e === 'delta' && last.i === ev.index && last.dtype === d.type) last.n++;
      else events.push({ e: 'delta', i: ev.index, dtype: d.type, n: 1 });
    } else if (t === 'content_block_stop') {
      // finalize input json
      if (partialJson[ev.index]) {
        try { blocks[ev.index].input = JSON.parse(partialJson[ev.index]); } catch { blocks[ev.index]._rawInput = partialJson[ev.index]; }
      }
      events.push({ e: 'block_stop', i: ev.index });
    } else if (t === 'message_delta') {
      if (ev.delta?.stop_reason) message.stop_reason = ev.delta.stop_reason;
      if (ev.delta?.stop_sequence) message.stop_sequence = ev.delta.stop_sequence;
      if (ev.usage) message.usage = { ...message.usage, ...ev.usage };
      if (ev.delta?.container) message.container = ev.delta.container;
      if (ev.container) message.container = ev.container;
      events.push({ e: 'message_delta', stop_reason: ev.delta?.stop_reason, usage: ev.usage, container: ev.delta?.container || ev.container });
    } else if (t === 'message_stop') {
      events.push({ e: 'message_stop' });
      if (ev.container) message.container = ev.container;
    } else if (t === 'error') {
      events.push({ e: 'error', error: ev.error });
      message.streamError = ev.error;
    } else {
      events.push({ e: t });
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop();
    for (const part of parts) {
      const dataLine = part.split('\n').find(l => l.startsWith('data:'));
      if (!dataLine) continue;
      const json = dataLine.slice(5).trim();
      if (!json || json === '[DONE]') continue;
      try { handle(JSON.parse(json)); } catch (e) { rawLines.push('PARSE_ERR ' + json); }
    }
  }
  // compact blocks (remove holes)
  message.content = blocks.filter(Boolean);
  if (rawPath) fs.writeFileSync(rawPath, rawLines.join('\n'));
  return { httpStatus: res.status, events, message, raw: rawLines };
}

// Find client tool_use blocks that need a result (both direct and code_execution callers).
export function pendingClientToolUses(content) {
  return content.filter(b => b.type === 'tool_use');
}
// server_tool_use blocks without a paired result in the same content array
export function unresolvedServerToolUses(content) {
  const resultIds = new Set(content.filter(b => b.tool_use_id).map(b => b.tool_use_id));
  return content.filter(b => b.type === 'server_tool_use' && !resultIds.has(b.id));
}

// Run a full agentic loop: keep resolving client tools / continuing pause_turn until terminal.
// Returns array of turn records.
export async function runLoop({ label, body, maxTurns = 8, resolve = runClientTool, injectResult }) {
  const turns = [];
  let messages = body.messages.slice();
  let container = body.container;
  for (let turn = 0; turn < maxTurns; turn++) {
    const reqBody = { ...body, messages, ...(container ? { container } : {}) };
    const rawPath = path.join(OUT, `${label}.turn${turn}.sse.txt`);
    const r = await callStream(reqBody, { rawPath });
    const rec = {
      turn,
      request: { messageCount: messages.length, container: container || null, lastUserPreview: previewLastUser(messages) },
      httpStatus: r.httpStatus,
      error: r.error || r.message?.streamError || null,
      stop_reason: r.message?.stop_reason,
      usage: r.message?.usage,
      container: r.message?.container,
      content: r.message?.content,
      events: r.events,
    };
    turns.push(rec);
    if (r.error || r.message?.streamError) break;
    const content = r.message.content;
    if (r.message.container?.id) container = r.message.container.id;

    // append assistant turn
    messages = messages.concat([{ role: 'assistant', content }]);

    const stop = r.message.stop_reason;
    if (stop === 'pause_turn') {
      // re-send as-is (assistant already appended); loop will re-issue with same messages
      continue;
    }
    if (stop === 'tool_use') {
      const clientCalls = pendingClientToolUses(content);
      if (clientCalls.length === 0) break; // nothing we can do
      const toolResults = clientCalls.map(tc => ({
        type: 'tool_result',
        tool_use_id: tc.id,
        content: injectResult ? injectResult(tc) : resolve(tc.name, tc.input || {}),
      }));
      messages = messages.concat([{ role: 'user', content: toolResults }]);
      continue;
    }
    // terminal: end_turn, max_tokens, stop_sequence, etc.
    break;
  }
  return { label, turns, finalMessages: messages };
}

function previewLastUser(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      const c = messages[i].content;
      if (typeof c === 'string') return c.slice(0, 80);
      return c.map(b => b.type === 'tool_result' ? `tool_result(${b.tool_use_id})` : b.type).join(',');
    }
  }
  return '';
}

export function save(label, obj) {
  const p = path.join(OUT, `${label}.json`);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
}

// concise structural summary of a content array for console
export function summarize(content) {
  if (!content) return '(none)';
  return content.map(b => {
    if (b.type === 'text') return `text[${(b.text || '').length}c]`;
    if (b.type === 'thinking') return 'thinking';
    if (b.type === 'server_tool_use') return `SRV:${b.name}#${b.id?.slice(-6)}`;
    if (b.type === 'tool_use') return `CLIENT:${b.name}#${b.id?.slice(-6)}${b.caller ? `(caller=${b.caller.type}${b.caller.tool_id ? '/' + b.caller.tool_id.slice(-6) : ''})` : ''}`;
    if (b.type?.endsWith('_tool_result')) return `RESULT<-${b.tool_use_id?.slice(-6)}[${b.type}]`;
    return b.type;
  }).join('  ');
}
