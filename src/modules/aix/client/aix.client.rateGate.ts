/**
 * AixRateGate - Per-model rate limiting for AIX chat generation requests.
 *
 * Provides token-aware (TPM) and request-count (RPM) rate limiting to prevent
 * hitting provider rate limits, especially during Beam scatter with large contexts.
 *
 * Design:
 * - In-memory singleton, per-client only (no cross-client coordination)
 * - Gate key is `serviceId:modelId` (matches provider per-model rate limit scoping,
 *   and separates different API keys/services)
 * - Token estimation uses char count / 4 heuristic (providers estimate similarly)
 * - JS single-threaded event loop provides natural concurrency safety
 * - Queued requests respect AbortSignal for cancellation
 * - Supports bulk flush for cancelling all queued requests in a gate
 *
 * @module aix
 */

import type { AixAPIChatGenerate_Request } from '../server/api/aix.wiretypes';


/// Configuration

/**
 * Rate limit configuration, computed by the caller and passed to _LL.
 * When null, no rate limiting is applied.
 */
export interface AixRateLimitConfig {
  gateKey: string;              // serviceId:modelId
  estimatedInputTokens: number; // estimated from message history (chars / 4)
  maxRPM: number | null;        // null = no RPM limit
  maxTPM: number | null;        // null = no TPM limit
}


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
  // latest configured limits (updated on each acquire)
  maxRPM: number | null;
  maxTPM: number | null;
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

function _getOrCreateGate(gateKey: string, maxRPM: number | null, maxTPM: number | null): _GateState {
  let gate = _gates.get(gateKey);
  if (!gate) {
    gate = { window: [], queue: [], drainTimer: null, maxRPM, maxTPM };
    _gates.set(gateKey, gate);
  } else {
    // update limits to latest values (user may have changed them)
    gate.maxRPM = maxRPM;
    gate.maxTPM = maxTPM;
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
function _hasCapacity(gate: _GateState, estimatedTokens: number): boolean {
  const usage = _getWindowUsage(gate);
  if (gate.maxRPM !== null && usage.rpm >= gate.maxRPM)
    return false;
  if (gate.maxTPM !== null && (usage.tpm + estimatedTokens) > gate.maxTPM)
    return false;
  return true;
}

/** Calculate how long to wait before the next request might be possible. */
function _estimateWaitMs(gate: _GateState): number {
  if (gate.window.length === 0) return 0;

  const now = Date.now();
  let waitMs = 0;

  // If RPM is the bottleneck, wait for the oldest request to expire
  if (gate.maxRPM !== null && gate.window.length >= gate.maxRPM) {
    const oldestTs = gate.window[0].timestamp;
    waitMs = Math.max(waitMs, oldestTs + 60_000 - now);
  }

  // If TPM is the bottleneck, wait for enough token capacity to free up
  if (gate.maxTPM !== null) {
    const usage = _getWindowUsage(gate);
    if (usage.tpm >= gate.maxTPM && gate.window.length > 0) {
      const oldestTs = gate.window[0].timestamp;
      waitMs = Math.max(waitMs, oldestTs + 60_000 - now);
    }
  }

  // Minimum wait of 100ms to avoid busy-spinning, capped at 60s
  return Math.min(Math.max(waitMs, 100), 60_000);
}

/** Schedule the drain timer to process queued requests. */
function _scheduleDrain(gate: _GateState): void {
  if (gate.drainTimer !== null) return; // already scheduled
  if (gate.queue.length === 0) return; // nothing to drain

  const waitMs = _estimateWaitMs(gate);
  gate.drainTimer = setTimeout(() => {
    gate.drainTimer = null;
    _drainQueue(gate);
  }, waitMs);
}

/** Process as many queued requests as capacity allows. */
function _drainQueue(gate: _GateState): void {
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
    if (!_hasCapacity(gate, next.estimatedTokens)) {
      // No capacity — reschedule drain
      _scheduleDrain(gate);
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
  config: AixRateLimitConfig,
  abortSignal: AbortSignal,
): Promise<void> {
  const { gateKey, estimatedInputTokens, maxRPM, maxTPM } = config;

  // If no limits are configured, pass through immediately
  if (maxRPM === null && maxTPM === null)
    return;

  const gate = _getOrCreateGate(gateKey, maxRPM, maxTPM);

  // Fast path: if capacity is available and queue is empty, proceed immediately
  if (gate.queue.length === 0 && _hasCapacity(gate, estimatedInputTokens)) {
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
    _scheduleDrain(gate);
  });
}


/**
 * Flush all queued requests for a gate key. Useful for bulk cancellation
 * (e.g., stopping a Beam scatter session with many queued rays).
 *
 * Does NOT cancel inflight requests (those have their own AbortControllers).
 * Does NOT consume capacity — flushed requests are removed without recording
 * them in the sliding window.
 */
export function aixRateGate_flushGate(gateKey: string): void {
  const gate = _gates.get(gateKey);
  if (!gate) return;

  // Clear drain timer
  if (gate.drainTimer !== null) {
    clearTimeout(gate.drainTimer);
    gate.drainTimer = null;
  }

  // Reject all queued requests in one batch (avoids O(n^2) splice in abort handlers)
  const queued = gate.queue.splice(0);
  for (const req of queued) {
    req.abortSignal.removeEventListener('abort', req.onAbort);
    req.reject(new DOMException('Rate gate flushed.', 'AbortError'));
  }
}
