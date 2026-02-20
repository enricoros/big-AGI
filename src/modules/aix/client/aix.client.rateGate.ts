/**
 * AixRateGate — Client-side rate limiter for AIX chat generation requests.
 *
 * Provides per-model rate limiting with RPM (requests per minute) and TPM
 * (tokens per minute) constraints. All conditions are checked conjunctively —
 * a request proceeds only when EVERY configured limit is satisfied.
 *
 * Used as a pass-through proxy wrapping _LL in aix.client.ts:
 * - Before _LL: acquire the gate (may queue/wait if limits exceeded)
 * - After _LL: feed actual token counts back for accuracy + signal queued requests
 *
 * Architecture:
 * - Sliding 60-second window tracking dispatched requests per gate key
 * - FIFO queue with AbortSignal support for pending requests
 * - Timer-based drain when oldest window entries expire
 * - Completion-triggered drain for faster throughput
 * - JS single-threaded event loop provides natural concurrency safety (no mutex)
 */


// Configuration for rate limiting a request
export interface AixRateLimitConfig {
  maxRPM: number | null;  // max requests per minute (null = no limit)
  maxTPM: number | null;  // max input tokens per minute (null = no limit)
}


// --- Internal types ---

interface _WindowEntry {
  timestamp: number;
  tokens: number;
}

interface _QueueEntry {
  resolve: () => void;
  reject: (reason: unknown) => void;
  estimatedTokens: number;
  abortSignal: AbortSignal;
  _onAbort: () => void; // stored for removeEventListener cleanup
}

interface _GateState {
  config: AixRateLimitConfig;     // latest config (updated on each acquire)
  window: _WindowEntry[];         // sliding 60s window of dispatched requests
  queue: _QueueEntry[];           // FIFO queue of waiting requests
  drainTimer: ReturnType<typeof setTimeout> | null;
}


// --- Module state ---

const _gates = new Map<string, _GateState>();
const WINDOW_MS = 60_000; // 60-second sliding window


// --- Internal helpers ---

function _getOrCreateGate(gateKey: string, config: AixRateLimitConfig): _GateState {
  let gate = _gates.get(gateKey);
  if (!gate) {
    gate = { config, window: [], queue: [], drainTimer: null };
    _gates.set(gateKey, gate);
  } else {
    gate.config = config; // always use latest config
  }
  return gate;
}

function _pruneWindow(gate: _GateState): void {
  const cutoff = Date.now() - WINDOW_MS;
  while (gate.window.length > 0 && gate.window[0].timestamp < cutoff)
    gate.window.shift();
}

/**
 * Check all conditions conjunctively. Returns true only if ALL configured
 * limits would be satisfied by admitting a request with the given token count.
 */
function _canAdmit(gate: _GateState, estimatedTokens: number): boolean {
  const { config } = gate;

  // RPM check: request count in window must be below limit
  if (config.maxRPM !== null && gate.window.length >= config.maxRPM)
    return false;

  // TPM check: total tokens in window + new request must be below limit
  if (config.maxTPM !== null) {
    const windowTokens = gate.window.reduce((sum, e) => sum + e.tokens, 0);
    if (windowTokens + estimatedTokens > config.maxTPM)
      return false;
  }

  return true;
}

function _drainQueue(gate: _GateState): void {
  _pruneWindow(gate);

  while (gate.queue.length > 0) {
    const entry = gate.queue[0];

    // Skip aborted entries
    if (entry.abortSignal.aborted) {
      gate.queue.shift();
      entry.abortSignal.removeEventListener('abort', entry._onAbort);
      entry.reject(new DOMException('Rate limit wait aborted.', 'AbortError'));
      continue;
    }

    // Check all conditions (conjunctive)
    if (!_canAdmit(gate, entry.estimatedTokens))
      break;

    // Admit: move from queue to window
    gate.queue.shift();
    entry.abortSignal.removeEventListener('abort', entry._onAbort);
    gate.window.push({ timestamp: Date.now(), tokens: entry.estimatedTokens });
    entry.resolve();
  }

  // Schedule next drain if queue is non-empty
  _scheduleDrain(gate);
}

function _scheduleDrain(gate: _GateState): void {
  // Clear existing timer
  if (gate.drainTimer !== null) {
    clearTimeout(gate.drainTimer);
    gate.drainTimer = null;
  }

  // Nothing to drain
  if (gate.queue.length === 0)
    return;

  // Schedule when the oldest window entry expires (freeing capacity)
  const oldestTs = gate.window.length > 0 ? gate.window[0].timestamp : Date.now();
  const delay = Math.max(100, (oldestTs + WINDOW_MS) - Date.now());

  gate.drainTimer = setTimeout(() => {
    gate.drainTimer = null;
    _drainQueue(gate);
  }, delay);
}


// --- Public API ---

/**
 * Acquire a slot in the rate gate. If all conditions (RPM, TPM) are satisfied,
 * the request proceeds immediately. Otherwise it's queued until conditions are met.
 *
 * The AbortSignal allows cancellation while waiting in the queue.
 * @throws DOMException (AbortError) if aborted while waiting.
 */
export async function aixRateGate_acquire(
  gateKey: string,
  config: AixRateLimitConfig,
  estimatedTokens: number,
  abortSignal: AbortSignal,
): Promise<void> {
  const gate = _getOrCreateGate(gateKey, config);
  _pruneWindow(gate);

  // Fast path: queue is empty and all conditions pass
  if (gate.queue.length === 0 && _canAdmit(gate, estimatedTokens)) {
    gate.window.push({ timestamp: Date.now(), tokens: estimatedTokens });
    return;
  }

  // Slow path: enqueue and wait for drain
  return new Promise<void>((resolve, reject) => {
    // Already aborted — reject immediately
    if (abortSignal.aborted) {
      reject(new DOMException('Rate limit wait aborted.', 'AbortError'));
      return;
    }

    const entry: _QueueEntry = {
      resolve,
      reject,
      estimatedTokens,
      abortSignal,
      _onAbort: () => {
        const idx = gate.queue.indexOf(entry);
        if (idx >= 0) {
          gate.queue.splice(idx, 1);
          abortSignal.removeEventListener('abort', entry._onAbort);
          reject(new DOMException('Rate limit wait aborted.', 'AbortError'));
        }
      },
    };

    abortSignal.addEventListener('abort', entry._onAbort);
    gate.queue.push(entry);
    _scheduleDrain(gate);
  });
}

/**
 * Notify the gate that a request has completed. Updates the window entry
 * with actual token counts (if available) and attempts to drain queued requests.
 *
 * Called by the _LL proxy wrapper after a request finishes.
 */
export function aixRateGate_notifyRequestComplete(
  gateKey: string,
  estimatedTokens: number,
  actualInputTokens?: number,
): void {
  const gate = _gates.get(gateKey);
  if (!gate) return;

  // Update window entry with actual tokens (improves accuracy for future decisions)
  if (actualInputTokens !== undefined && actualInputTokens !== estimatedTokens) {
    for (let i = gate.window.length - 1; i >= 0; i--) {
      if (gate.window[i].tokens === estimatedTokens) {
        gate.window[i].tokens = actualInputTokens;
        break;
      }
    }
  }

  // Try to drain queue (completed request may have freed capacity via actual tokens)
  if (gate.queue.length > 0)
    _drainQueue(gate);
}

/**
 * Flush all queued requests for a gate key. Rejects all queued promises
 * with AbortError. Does NOT affect in-flight requests or window entries.
 *
 * Use for bulk cancellation (e.g., stopping a Beam scatter session).
 */
export function aixRateGate_flushGate(gateKey: string): void {
  const gate = _gates.get(gateKey);
  if (!gate) return;

  // Clear drain timer
  if (gate.drainTimer !== null) {
    clearTimeout(gate.drainTimer);
    gate.drainTimer = null;
  }

  // Reject and clean up all queued entries (single O(n) pass)
  const queued = gate.queue.splice(0);
  for (const entry of queued) {
    entry.abortSignal.removeEventListener('abort', entry._onAbort);
    entry.reject(new DOMException('Rate limit queue flushed.', 'AbortError'));
  }
}

/**
 * Estimate input tokens from an AixAPIChatGenerate_Request.
 * Uses JSON serialization length / 4 as a rough heuristic.
 *
 * This intentionally overestimates for binary content (base64 images),
 * which is the safe direction for rate limiting (more conservative gating).
 * The actual token count fed back via notifyRequestComplete corrects the
 * window entry for improved accuracy.
 */
export function aixRateGate_estimateInputTokens(chatGenerate: object): number {
  try {
    const json = JSON.stringify(chatGenerate);
    return Math.ceil(json.length / 4);
  } catch {
    return 10_000; // safe fallback
  }
}
