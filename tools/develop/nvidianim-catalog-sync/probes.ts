/**
 * NVIDIA Catalog Harvest - source 4: authenticated live probes.
 *
 * Two probes per model, both POST /v1/chat/completions:
 *  a. liveness   - a 4-token 'hi' completion, classified from status + body
 *  b. context    - a deliberately oversized prompt, so the 400 error body states the real window
 *
 * PACING: the account allows 40 requests/minute, so every request (retries included) passes through
 * one global gate that keeps request starts at least MIN_REQUEST_SPACING_MS apart, strictly serial.
 * The Authorization header is built here and never logged.
 */

import type { AliveClass, CtxProbeNote } from './types';


const CHAT_COMPLETIONS_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

/** 40 requests/minute = 1500ms; 1600ms leaves headroom for clock jitter. */
const MIN_REQUEST_SPACING_MS = 1600;
const REQUEST_TIMEOUT_MS = 45_000;
/**
 * 45s is not always enough: cold-start models take longer to answer even a 4-token completion, and
 * the oversized context prompt has to be fully tokenized before it can be rejected. So when (and
 * only when) a request times out, its single retry runs with an escalated timeout. Without this,
 * live models (minimax-m3, llama-4-maverick) get misfiled as slow-or-dead and real context windows
 * are lost - a false 'dead' is far more damaging to the curated table than a slow run.
 */
const ESCALATED_TIMEOUT_MS = 120_000;
const RETRY_DELAY_MS = 2000;

/** 1.2M repetitions of 'x ' = 2.4M characters, far past every published window. */
const CTX_PROBE_REPEATS = 1_200_000;

/** Ordered: the first regex that matches wins, vendors word the 400 differently. */
const CTX_LIMIT_REGEXES = [
  /context length is (\d+)/,
  /max_model_len=max_total_tokens=(\d+)/,
  /maximum context length of (\d+)/,
  /only (\d{3,8}) is supported/,
  /less than or equal to (\d{3,8})/,
  // vLLM-style wording, found empirically on dracarys/palmyra:
  // "The input (1200010 tokens) is longer than the model's context length (131072 tokens)."
  /context length \((\d{3,8}) tokens\)/,
  // gateway wording, found empirically on mistral-small-4 and nemotron-nano-9b-v2:
  // "You passed 1200015 input tokens and requested 1 output tokens. However, the model's
  //  context length is only 262144 tokens, resulting in ..."
  /context length is only (\d{3,8})/,
];

/*
 * Not machine-parseable, deliberately left as 'no-match' with the raw body kept in notes[]:
 *  - "max_tokens must be at least 1, got -1068994" (gpt-oss-*, mistral-nemotron). The window is
 *    recoverable only as inputTokens + got, and the API never states inputTokens, so deriving it
 *    would mean guessing the tokenizer. Curate these from the card instead.
 */


// --- global pacing gate ---

let _lastRequestStartedAt = 0;

function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function _paceGate(): Promise<void> {
  const waitMs = _lastRequestStartedAt + MIN_REQUEST_SPACING_MS - Date.now();
  if (waitMs > 0) await _sleep(waitMs);
  _lastRequestStartedAt = Date.now();
}


// --- raw paced request ---

interface RawResult {
  status: number | null;   // null on transport failure / timeout
  body: string;
  timedOut: boolean;
  elapsedMs: number;
}

async function _pacedChatRequest(apiKey: string, payload: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<RawResult> {
  await _paceGate();
  const startedAt = Date.now();
  try {
    const response = await fetch(CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.text();
    return { status: response.status, body, timedOut: false, elapsedMs: Date.now() - startedAt };
  } catch (error: unknown) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const timedOut = /timeout|abort|timed out/i.test(message);
    return { status: null, body: message, timedOut, elapsedMs: Date.now() - startedAt };
  }
}


// --- probe a: liveness ---

export interface LivenessResult {
  alive: AliveClass;
  notes: string[];
}

function _classify(result: RawResult): { alive: AliveClass; note: string | null } | null {
  const { status, body } = result;

  if (status === 200)
    return { alive: 'alive', note: null };

  if (status === 404) {
    if (body.includes('Not found for account'))
      return { alive: 'dead-entitlement', note: '404 Not found for account (function removed)' };
    if (body.includes('404 page not found'))
      return { alive: 'no-chat-route', note: 'plain-text 404 page not found (no chat route: embedding/rerank class)' };
    return { alive: 'probe-error', note: `404: ${body.slice(0, 150).replace(/\s+/g, ' ').trim()}` };
  }

  if (status === 410) {
    const isoDate = body.match(/(20\d{2}-\d{2}-\d{2})/);
    return { alive: 'retired', note: isoDate ? `410 Gone, retired ${isoDate[1]}` : '410 Gone' };
  }

  if (status === 429 || status === 503)
    return { alive: 'throttled', note: `${status} - inconclusive, not a death signal` };

  if (status !== null)
    return { alive: 'probe-error', note: `HTTP ${status}: ${body.slice(0, 150).replace(/\s+/g, ' ').trim()}` };

  return null; // transport failure - the caller decides between retry and slow-or-dead
}

export async function probeLiveness(apiKey: string, modelId: string): Promise<LivenessResult> {
  const notes: string[] = [];
  const payload = { model: modelId, messages: [{ role: 'user', content: 'hi' }], max_tokens: 4 };

  let timeouts = 0;
  let lastTransportNote: string | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt === 2) await _sleep(RETRY_DELAY_MS);

    // the retry escalates its timeout only when the first attempt actually timed out
    const timeoutMs = attempt === 2 && timeouts > 0 ? ESCALATED_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
    const result = await _pacedChatRequest(apiKey, payload, timeoutMs);
    const classified = _classify(result);

    if (classified) {
      if (classified.alive === 'alive') {
        if (attempt === 2) notes.push(`alive on retry (first attempt failed${timeouts ? `, needed the escalated ${ESCALATED_TIMEOUT_MS / 1000}s timeout` : ''})`);
        return { alive: 'alive', notes };
      }
      if (attempt === 2 || classified.alive === 'dead-entitlement' || classified.alive === 'no-chat-route' || classified.alive === 'retired') {
        if (classified.note) notes.push(classified.note);
        return { alive: classified.alive, notes };
      }
      lastTransportNote = classified.note;
      continue; // retry once for throttled / probe-error
    }

    if (result.timedOut) timeouts++;
    else lastTransportNote = `transport: ${result.body.slice(0, 150)}`;
  }

  if (timeouts >= 2)
    return { alive: 'slow-or-dead', notes: [...notes, `timed out at ${REQUEST_TIMEOUT_MS / 1000}s and again at ${ESCALATED_TIMEOUT_MS / 1000}s`] };
  if (timeouts === 1)
    notes.push(`one attempt timed out at ${REQUEST_TIMEOUT_MS / 1000}s`);
  if (lastTransportNote) notes.push(lastTransportNote);
  return { alive: 'probe-error', notes: notes.length ? notes : ['probe failed without a classifiable response'] };
}


// --- probe b: context window ---

export interface CtxProbeResult {
  ctxMeasured: number | null;
  ctxProbe: CtxProbeNote | null;
  note: string | null;
}

export function parseCtxFromErrorBody(body: string): number | null {
  for (const regex of CTX_LIMIT_REGEXES) {
    const match = body.match(regex);
    if (!match) continue;
    const value = parseInt(match[1], 10);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

export async function probeContextWindow(apiKey: string, modelId: string): Promise<CtxProbeResult> {
  const payload = { model: modelId, messages: [{ role: 'user', content: 'x '.repeat(CTX_PROBE_REPEATS) }], max_tokens: 1 };

  let result = await _pacedChatRequest(apiKey, payload);
  let escalated = false;
  if (result.status === null && result.timedOut) {
    escalated = true;
    result = await _pacedChatRequest(apiKey, payload, ESCALATED_TIMEOUT_MS);
  }

  if (result.status === null) {
    if (result.timedOut)
      return { ctxMeasured: null, ctxProbe: 'timeout', note: `ctx probe timed out at ${REQUEST_TIMEOUT_MS / 1000}s${escalated ? ` and again at ${ESCALATED_TIMEOUT_MS / 1000}s` : ''}` };
    return { ctxMeasured: null, ctxProbe: 'error', note: `ctx probe transport: ${result.body.slice(0, 150)}` };
  }

  if (result.status === 200)
    return { ctxMeasured: null, ctxProbe: 'silent-truncation-or-large', note: 'ctx probe returned 200 (model silently truncates, or the window exceeds the probe)' };

  const measured = parseCtxFromErrorBody(result.body);
  if (measured !== null)
    return { ctxMeasured: measured, ctxProbe: null, note: escalated ? `ctx probe needed the escalated ${ESCALATED_TIMEOUT_MS / 1000}s timeout` : null };

  return {
    ctxMeasured: null,
    ctxProbe: 'no-match',
    note: `ctx probe HTTP ${result.status}, no limit in body: ${result.body.slice(0, 150).replace(/\s+/g, ' ').trim()}`,
  };
}

export const PROBE_PACING_MS = MIN_REQUEST_SPACING_MS;
