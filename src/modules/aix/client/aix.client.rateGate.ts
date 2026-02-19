/**
 * AixRateGate - Per-model rate limiting for AIX chat generation requests.
 *
 * Provides token-aware (TPM) and request-count (RPM) rate limiting to prevent
 * hitting provider rate limits, especially during Beam scatter with large contexts.
 *
 * Design:
 * - In-memory singleton, per-client only (no cross-client coordination)
 * - Gate key is per model ID (matches provider per-model rate limit scoping)
 * - Token estimation uses char count / 4 heuristic (providers estimate similarly)
 * - JS single-threaded event loop provides natural concurrency safety
 * - Queued requests respect AbortSignal for cancellation
 *
 * @module aix
 */

import type { AixAPIChatGenerate_Request } from '../server/api/aix.wiretypes';


/// Types

interface _GateEntry {
  timestamp: number;
  tokens: number;
}

interface _QueuedRequest {
  resolve: () => void;
  reject: (reason: unknown) => void;
  estimatedTokens: number;
  abortSignal: AbortSignal;
  onAbort: () => void;
}

interface _GateState {
  // sliding window of completed+inflight requests within the last 60 seconds
  window: _GateEntry[];
  // pending requests waiting for capacity
  queue: _QueuedRequest[];
  // drain timer for processing the queue
  drainTimer: ReturnType<typeof setTimeout> | null;
}


/// Token Estimation

/**
 * Rough estimate of input tokens from an AixAPIChatGenerate_Request.
 * Uses char count / 4 as a heuristic — sufficient for rate gating purposes,
 * since providers themselves estimate at request start and adjust later.
 */
export function aixRateGate_estimateInputTokens(request: AixAPIChatGenerate_Request): number {
  let charCount = 0;

  // system message
  if (request.systemMessage) {
    for (const part of request.systemMessage.parts) {
      if ('text' in part) charCount += part.text.length;
      // cache markers, etc. add negligible overhead
    }
  }

  // chat sequence — use JSON.stringify as a rough char count proxy for all part types
  for (const msg of request.chatSequence) {
    for (const part of msg.parts) {
      if ('text' in part) charCount += part.text.length;
      else charCount += JSON.stringify(part).length;
    }
  }

  // Apply 1.1x safety margin and divide by 4 (chars to tokens rough ratio)
  return Math.ceil((charCount * 1.1) / 4);
}


/// Gate State Management

const _gates = new Map<string, _GateState>();

function _getOrCreateGate(gateKey: string): _GateState {
  let gate = _gates.get(gateKey);
  if (!gate) {
    gate = { window: [], queue: [], drainTimer: null };
    _gates.set(gateKey, gate);
  }
  return gate;
}

/** Remove entries older than 60 seconds from the sliding window. */
function _pruneWindow(gate: _GateState): void {
  const cutoff = Date.now() - 60_000;
  // window is chronologically ordered, so we can find the first valid index
  let firstValid = 0;
  while (firstValid < gate.window.length && gate.window[firstValid].timestamp < cutoff)
    firstValid++;
  if (firstValid > 0)
    gate.window.splice(0, firstValid);
}

/** Get current RPM and TPM usage within the sliding window. */
function _getWindowUsage(gate: _GateState): { rpm: number; tpm: number } {
  _pruneWindow(gate);
  let tpm = 0;
  for (const entry of gate.window)
    tpm += entry.tokens;
  return { rpm: gate.window.length, tpm };
}

/** Check if a request with the given estimated tokens can proceed. */
function _hasCapacity(gate: _GateState, estimatedTokens: number, maxRPM: number | null, maxTPM: number | null): boolean {
  const usage = _getWindowUsage(gate);
  if (maxRPM !== null && usage.rpm >= maxRPM)
    return false;
  if (maxTPM !== null && (usage.tpm + estimatedTokens) > maxTPM)
    return false;
  return true;
}

/** Calculate how long to wait before the next request might be possible. */
function _estimateWaitMs(gate: _GateState, maxRPM: number | null, maxTPM: number | null): number {
  if (gate.window.length === 0) return 0;

  const now = Date.now();
  let waitMs = 0;

  // If RPM is the bottleneck, wait for the oldest request to expire
  if (maxRPM !== null && gate.window.length >= maxRPM) {
    const oldestTs = gate.window[0].timestamp;
    waitMs = Math.max(waitMs, oldestTs + 60_000 - now);
  }

  // If TPM is the bottleneck, wait for enough token capacity to free up
  if (maxTPM !== null) {
    const usage = _getWindowUsage(gate);
    if (usage.tpm >= maxTPM && gate.window.length > 0) {
      // Wait for the oldest entry to expire
      const oldestTs = gate.window[0].timestamp;
      waitMs = Math.max(waitMs, oldestTs + 60_000 - now);
    }
  }

  // Minimum wait of 100ms to avoid busy-spinning, capped at 60s
  return Math.min(Math.max(waitMs, 100), 60_000);
}

/** Schedule the drain timer to process queued requests. */
function _scheduleDrain(gate: _GateState, gateKey: string, maxRPM: number | null, maxTPM: number | null): void {
  if (gate.drainTimer !== null) return; // already scheduled
  if (gate.queue.length === 0) return; // nothing to drain

  const waitMs = _estimateWaitMs(gate, maxRPM, maxTPM);
  gate.drainTimer = setTimeout(() => {
    gate.drainTimer = null;
    _drainQueue(gate, gateKey, maxRPM, maxTPM);
  }, waitMs);
}

/** Process as many queued requests as capacity allows. */
function _drainQueue(gate: _GateState, gateKey: string, maxRPM: number | null, maxTPM: number | null): void {
  while (gate.queue.length > 0) {
    const next = gate.queue[0];

    // Skip aborted requests
    if (next.abortSignal.aborted) {
      gate.queue.shift();
      next.abortSignal.removeEventListener('abort', next.onAbort);
      next.reject(new DOMException('Aborted while queued in rate limiter.', 'AbortError'));
      continue;
    }

    // Check capacity
    if (!_hasCapacity(gate, next.estimatedTokens, maxRPM, maxTPM)) {
      // No capacity — reschedule drain
      _scheduleDrain(gate, gateKey, maxRPM, maxTPM);
      return;
    }

    // Admit the request
    gate.queue.shift();
    next.abortSignal.removeEventListener('abort', next.onAbort);
    gate.window.push({ timestamp: Date.now(), tokens: next.estimatedTokens });
    next.resolve();
  }
}


/// Public API

/**
 * Acquire rate-limited permission to proceed with a request.
 *
 * If there's capacity, resolves immediately after recording the request.
 * Otherwise, queues the request and resolves when capacity frees up.
 *
 * @throws DOMException with name 'AbortError' if aborted while queued
 */
export async function aixRateGate_acquire(
  gateKey: string,
  estimatedInputTokens: number,
  maxRPM: number | null | undefined, // null/undefined = no RPM limit
  maxTPM: number | null | undefined, // null/undefined = no TPM limit
  abortSignal: AbortSignal,
): Promise<void> {
  // Normalize: treat undefined same as null (no limit)
  const rpm = maxRPM ?? null;
  const tpm = maxTPM ?? null;

  // If no limits are configured, pass through immediately
  if (rpm === null && tpm === null)
    return;

  const gate = _getOrCreateGate(gateKey);

  // Fast path: if capacity is available and queue is empty, proceed immediately
  if (gate.queue.length === 0 && _hasCapacity(gate, estimatedInputTokens, rpm, tpm)) {
    gate.window.push({ timestamp: Date.now(), tokens: estimatedInputTokens });
    return;
  }

  // Slow path: enqueue and wait
  return new Promise<void>((resolve, reject) => {
    // Check abort before queueing
    if (abortSignal.aborted) {
      reject(new DOMException('Aborted before rate limit queueing.', 'AbortError'));
      return;
    }

    const queuedRequest: _QueuedRequest = {
      resolve,
      reject,
      estimatedTokens: estimatedInputTokens,
      abortSignal,
      onAbort: () => {
        // Remove from queue and reject
        const idx = gate.queue.indexOf(queuedRequest);
        if (idx !== -1) {
          gate.queue.splice(idx, 1);
          reject(new DOMException('Aborted while queued in rate limiter.', 'AbortError'));
        }
      },
    };

    abortSignal.addEventListener('abort', queuedRequest.onAbort, { once: true });
    gate.queue.push(queuedRequest);

    // Schedule drain to process when capacity frees up
    _scheduleDrain(gate, gateKey, rpm, tpm);
  });
}
