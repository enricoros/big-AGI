/**
 * AixRateGate — composable rate limiting for AIX chat generation.
 *
 * `withGating<T>()` is the main entry point — a generic async wrapper that:
 * 1. Checks user-configurable RPM/TPM limits against a sliding 60s window
 * 2. Queues if limits would be exceeded (respects AbortSignal for cancellation)
 * 3. Executes the wrapped function with full return-type inference preserved
 * 4. On completion, drains queued requests as capacity becomes available
 *
 * Design properties:
 * - Generic `<T>` preserves full type inference of the wrapped function
 * - Conjunctive gating: ALL configured limits must pass (RPM AND TPM)
 * - AbortSignal-aware: queued requests reject cleanly on abort
 * - Completion-triggered + timer-based queue drain
 * - In-memory, per-client state (no cross-client coordination)
 * - JS single-threaded event loop provides natural concurrency safety
 */

// configuration
const WINDOW_MS = 60_000; // 60-second sliding window
const DRAIN_POLL_MS = 1_000; // queue drain poll interval


/// Types

export interface AixRateLimitConfig {
  maxRPM: number | null; // null = no RPM limit
  maxTPM: number | null; // null = no TPM limit
}

interface _WindowEntry {
  ts: number;
  tokens: number;
}

interface _QueueEntry {
  resolve: () => void;
  reject: (reason?: any) => void;
  estimatedTokens: number;
  abortSignal: AbortSignal;
  onAbort: () => void;
}

interface _GateState {
  config: AixRateLimitConfig;
  window: _WindowEntry[];
  queue: _QueueEntry[];
  drainTimer: ReturnType<typeof setTimeout> | null;
}


/// State (module-level, in-memory only)

const _gates = new Map<string, _GateState>();


/// Public API

/**
 * Composable rate-limiting wrapper. Enforces per-model RPM and TPM limits
 * before executing `fn`, queuing the request if limits would be exceeded.
 *
 * Generic type `T` is inferred from `fn`'s return type — full type safety preserved.
 *
 * @param gateKey Scoping key (typically model ID) — requests sharing a key share limits
 * @param config Rate limit configuration, or null to skip gating entirely (pass-through)
 * @param abortSignal Cancellation signal — removes request from queue if waiting
 * @param estimatedInputTokens Approximate input token count for TPM tracking
 * @param fn The async function to execute once capacity is available
 * @returns The result of `fn()` with its type fully preserved
 */
export async function withGating<T>(
  gateKey: string,
  config: AixRateLimitConfig | null,
  abortSignal: AbortSignal,
  estimatedInputTokens: number,
  fn: () => Promise<T>,
): Promise<T> {

  // Pass-through: no config or no limits configured
  if (!config || (config.maxRPM === null && config.maxTPM === null))
    return fn();

  const gate = _getOrCreateGate(gateKey, config);

  // Evict stale window entries
  _evictStale(gate);

  // Queue and wait if limits would be exceeded
  if (!_canAdmit(gate, estimatedInputTokens))
    await _enqueue(gate, estimatedInputTokens, abortSignal);

  // Admitted — record in sliding window
  gate.window.push({ ts: Date.now(), tokens: estimatedInputTokens });

  // Execute wrapped function, drain queue on completion
  try {
    return await fn();
  } finally {
    _drainQueue(gate);
  }
}


/**
 * Bulk-cancel all queued requests for a gate key. Does NOT abort in-flight requests
 * (those have their own AbortControllers). Use from beam scatter `stopScatteringAll()`
 * to prevent queued rays from proceeding.
 */
export function aixRateGate_flushGate(gateKey: string): void {
  const gate = _gates.get(gateKey);
  if (!gate) return;

  // Clear drain timer
  if (gate.drainTimer) {
    clearTimeout(gate.drainTimer);
    gate.drainTimer = null;
  }

  // Reject all queued entries in one pass
  const queued = gate.queue.splice(0);
  for (const entry of queued) {
    entry.abortSignal.removeEventListener('abort', entry.onAbort);
    entry.reject(new DOMException('Rate gate flushed.', 'AbortError'));
  }
}


/**
 * Rough input token estimation from a chat generate request object.
 * Uses character count / 4 with a 1.1x safety margin — sufficient for gating purposes.
 * (Providers themselves estimate similarly at request start and adjust later.)
 */
export function estimateInputTokens(request: unknown): number {
  return Math.ceil(JSON.stringify(request).length * 1.1 / 4);
}


/// Internals

function _getOrCreateGate(key: string, config: AixRateLimitConfig): _GateState {
  let gate = _gates.get(key);
  if (!gate) {
    gate = { config, window: [], queue: [], drainTimer: null };
    _gates.set(key, gate);
  } else {
    gate.config = config; // always use latest user config
  }
  return gate;
}

function _evictStale(gate: _GateState): void {
  const cutoff = Date.now() - WINDOW_MS;
  // Window entries are chronological — find first non-stale index
  let i = 0;
  while (i < gate.window.length && gate.window[i].ts < cutoff) i++;
  if (i > 0) gate.window.splice(0, i);
}

/** Conjunctive check: ALL configured limits must pass for admission. */
function _canAdmit(gate: _GateState, newTokens: number): boolean {
  const { config } = gate;

  // RPM check
  if (config.maxRPM !== null && gate.window.length >= config.maxRPM)
    return false;

  // TPM check
  if (config.maxTPM !== null) {
    const currentTokens = gate.window.reduce((sum, e) => sum + e.tokens, 0);
    if (currentTokens + newTokens > config.maxTPM)
      return false;
  }

  return true;
}

function _enqueue(gate: _GateState, estimatedTokens: number, abortSignal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // Reject immediately if already aborted
    if (abortSignal.aborted) {
      reject(new DOMException('Aborted while waiting for rate gate.', 'AbortError'));
      return;
    }

    const entry: _QueueEntry = {
      resolve, reject,
      estimatedTokens,
      abortSignal,
      onAbort: () => {
        const idx = gate.queue.indexOf(entry);
        if (idx !== -1) gate.queue.splice(idx, 1);
        reject(new DOMException('Aborted while waiting for rate gate.', 'AbortError'));
      },
    };

    abortSignal.addEventListener('abort', entry.onAbort, { once: true });
    gate.queue.push(entry);

    // Ensure drain timer is running to eventually admit this entry
    _ensureDrainTimer(gate);
  });
}

function _ensureDrainTimer(gate: _GateState): void {
  if (gate.drainTimer || !gate.queue.length) return;
  gate.drainTimer = setTimeout(() => {
    gate.drainTimer = null;
    _drainQueue(gate);
  }, DRAIN_POLL_MS);
}

function _drainQueue(gate: _GateState): void {
  _evictStale(gate);

  while (gate.queue.length > 0) {
    const entry = gate.queue[0];

    // Skip already-aborted entries
    if (entry.abortSignal.aborted) {
      gate.queue.shift();
      entry.abortSignal.removeEventListener('abort', entry.onAbort);
      continue;
    }

    // Stop if this entry can't be admitted yet
    if (!_canAdmit(gate, entry.estimatedTokens))
      break;

    // Admit: resolve the waiting promise
    gate.queue.shift();
    entry.abortSignal.removeEventListener('abort', entry.onAbort);
    entry.resolve();
  }

  // Re-schedule if queue still has entries
  if (gate.queue.length > 0)
    _ensureDrainTimer(gate);
}
