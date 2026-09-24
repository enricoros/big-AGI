import type { AixWire_Particles } from '../../api/aix.wiretypes';

import type { AixDebugObject } from './chatGenerate.debug';
import type { ChatGenerateDispatch } from './chatGenerate.dispatch';
import { executeChatGenerateWithOperationRetry } from './chatGenerate.operation-retry';


// configuration
const MAX_CONTINUATION_TURNS = 100; // this is the outer loop count, on top of the default inner loop count of each operation (i.e. 10 for Anthropic, for a total of 100 steps)
const DEBUG_CONTINUATION = true;


// --- Dispatch Continuation Signal ---

/**
 * Signal thrown by provider parsers to request dispatch continuation.
 * Distinct from OperationRetrySignal: retry resets the current dispatch; continuation preserves and appends.
 *
 * Stage 1 (current): body mutation - Anthropic pause_turn.
 * Future stages: replaceDispatch (OpenAI background/resumable), waitStrategy, etc.
 */
export class DispatchContinuationSignal extends Error {
  override readonly name = 'DispatchContinuationSignal';

  constructor(readonly continuation: {
    readonly reason: string;
    /** Display-only divider the client renders at the pause point, named by the vendor; never sent upstream. */
    readonly notice?: { kind: 'vnd.ant.pause_turn', text: string, detail?: string };
    mutateBody(body: Record<string, unknown>): Record<string, unknown>;
  }) {
    super(`dispatch-continuation: ${continuation.reason}`);
    Object.setPrototypeOf(this, DispatchContinuationSignal.prototype);
  }
}


// --- Continuation Metrics ---

const _ADDITIVE_METRICS = ['TIn', 'TCacheRead', 'TCacheWrite', 'TOut', 'TOutR', 'nWebSearch', 'nWebFetch', 'nCodeExec', 'dtInner', 'dtAll', '$cReported'] as const;

/** Running total across continuation turns: counts and durations add up, the first byte time is the generation's, the rate follows the totals, the rest is last-wins. */
function _sumContinuationMetrics(base: AixWire_Particles.CGSelectMetrics, turn: AixWire_Particles.CGSelectMetrics): AixWire_Particles.CGSelectMetrics {
  const sum: AixWire_Particles.CGSelectMetrics = { ...base, ...turn };
  for (const key of _ADDITIVE_METRICS) {
    const b = base[key], t = turn[key];
    if (b !== undefined || t !== undefined)
      sum[key] = (b ?? 0) + (t ?? 0);
  }
  if (base.dtStart !== undefined)
    sum.dtStart = base.dtStart;
  if (sum.TOut !== undefined && sum.dtInner)
    sum.vTOutInner = Math.round(sum.TOut / (sum.dtInner / 1000) * 100) / 100;
  return sum;
}


// --- Completion Stats ---

/**
 * Final stats of a chat generation. Generic - NO analytics dependency. `metrics` carries the
 * token/duration/cost snapshot; `terminationReason` says how generation ended ('done-dialect' = clean).
 */
export interface AixChatGenerateCompletionStats {
  metrics?: AixWire_Particles.CGSelectMetrics;       // token counts (TIn/TCacheRead/TOut/...), duration (dtAll), cost
  terminationReason?: AixWire_Particles.CGEndReason; // how generation ended ('done-dialect' = clean)
}

/** Accumulate completion stats from a passing-through particle (last value wins across continuation turns). */
function _captureCompletionStats(stats: AixChatGenerateCompletionStats, particle: AixWire_Particles.ChatGenerateOp): void {
  if (!('cg' in particle)) return; // text/part particles carry no stats
  if (particle.cg === 'set-metrics') stats.metrics = particle.metrics;
  else if (particle.cg === 'end') stats.terminationReason = particle.terminationReason;
}

/**
 * Composable completion-stats tap: re-yields a chat-generate particle stream untouched and, at its true end
 * (normal end, client abort, or error), awaits `onCompletionStats` with the captured stats - so an async sink
 * (e.g. an analytics POST) flushes before the stream closes. Kept separate so executeChatGenerateWithContinuation
 * stays clean: CSF and other callers use it directly, and opt into stats only by wrapping with this.
 */
export async function* withChatGenerateCompletionStats(
  particles: AsyncIterable<AixWire_Particles.ChatGenerateOp>,
  onCompletionStats: (stats: AixChatGenerateCompletionStats) => void | Promise<void>,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {
  const stats: AixChatGenerateCompletionStats = {};
  try {
    for await (const particle of particles) {
      _captureCompletionStats(stats, particle);
      yield particle;
    }
  } finally {
    await onCompletionStats(stats);
  }
}


// --- Continuation + Operation Retry + Dispatch ---

/**
 * Top-level chat generation entry point: [Anthropic]continuation (outer) -> operation retry (inner) -> dispatch.
 *
 * Handles dispatch continuations transparently. Provider parsers throw DispatchContinuationSignal;
 * this catches it, applies the body mutation to a fresh dispatch, and re-enters the operation retry
 * loop. Already-yielded particles are preserved - the client sees seamless continuation.
 *
 * Structurally similar to a client-side tool loop: when the model doesn't finish
 * (pause_turn instead of end_turn), accumulated content is sent back and the
 * model continues. Each individual dispatch can independently fail and be retried
 * by the inner operation retry loop without losing accumulated state.
 *
 * Composition:
 *  executeChatGenerateWithContinuation (catches DispatchContinuationSignal, mutates body, re-dispatches)
 *    -> executeChatGenerateWithOperationRetry (catches OperationRetrySignal, retries same dispatch)
 *      -> executeChatGenerateDispatch (single dispatch: connect, consume, yield particles)
 *         | particle pipeline: each yielded particle is piped through dispatch.particleTransform (e.g. Anthropic file inline)
 *        -> fetchWithAbortableConnectionRetry (retries HTTP connection)
 */
export async function* executeChatGenerateWithContinuation(
  dispatchCreatorFn: () => Promise<ChatGenerateDispatch>,
  abortSignal: AbortSignal,
  _d: AixDebugObject,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {

  let currentCreator = dispatchCreatorFn;

  // Metrics: every continuation turn is its own upstream request with its own usage, and each dispatch reports
  // full snapshots of its own - present the running total instead, so the message and the analytics see the
  // whole generation (a paused research turn re-reads its context on every server iteration: the cached tokens
  // of the earlier turns are the bulk of the bill)
  let metricsBase: AixWire_Particles.CGSelectMetrics | undefined = undefined;
  let metricsTurn: AixWire_Particles.CGSelectMetrics | undefined = undefined;

  for (let turn = 0; turn <= MAX_CONTINUATION_TURNS; turn++) {
    try {

      for await (const particle of executeChatGenerateWithOperationRetry(currentCreator, abortSignal, _d)) {
        if ('cg' in particle && particle.cg === 'set-metrics') {
          metricsTurn = particle.metrics;
          if (metricsBase) {
            yield { ...particle, metrics: _sumContinuationMetrics(metricsBase, particle.metrics) };
            continue;
          }
        }
        // A dropped-reasoning notice on a continuation turn means the paused turn we sent back was not accepted
        // as unchanged: the one case this loop must never produce. Mark it so the client renders a warning
        // instead of the harmless informational chip, with copy asking for a report.
        if (metricsBase && 'p' in particle && particle.p === 'vnt' && particle.nt === 'input-transform') {
          const indices = particle.detail?.split('\n').pop();
          yield {
            ...particle,
            level: 'warn',
            text: `Unexpected ${particle.text.charAt(0).toLowerCase()}${particle.text.slice(1)}`,
            detail: `The paused turn was sent back for continuation and the API found it changed, so it dropped these reasoning blocks. This should not happen after a pause - please report it with the indices below.${indices ? `\n${indices}` : ''}`,
          };
          continue;
        }
        yield particle;
      }
      return; // normal completion

    } catch (error) {
      // pass-through non-continuation errors (shall be rare, probably CSF errors or errors from exceeding retries, etc.)
      if (!(error instanceof DispatchContinuationSignal)) throw error;

      if (turn >= MAX_CONTINUATION_TURNS) {
        if (DEBUG_CONTINUATION) console.warn('[continuation] ❌ Max continuation turns reached', MAX_CONTINUATION_TURNS);
        throw error;
      }

      if (DEBUG_CONTINUATION) console.log(`[continuation] Turn ${turn + 1}/${MAX_CONTINUATION_TURNS}: ${error.continuation.reason}`);

      // Chain: each turn's creator calls the previous and applies its mutation.
      // The chained creator pattern composes mutations without an explicit list -
      // each mutateBody receives the body as-mutated by prior turns.
      const previousCreator = currentCreator;
      const { continuation } = error;

      currentCreator = async () => {
        const dispatch = await previousCreator();
        if ('body' in dispatch.request)
          dispatch.request.body = continuation.mutateBody(dispatch.request.body as Record<string, unknown>);
        return dispatch;
      };

      // this turn's usage joins the base the next request's snapshots are added to
      metricsBase = _sumContinuationMetrics(metricsBase ?? {}, metricsTurn ?? {});
      metricsTurn = undefined;

      // Divider at the pause point - yielded before the checkpoint, so a retried continuation keeps it
      if (continuation.notice)
        yield {
          p: 'vnt', nt: 'flow-cont', kind: continuation.notice.kind, turn: turn + 1, text: continuation.notice.text,
          detail: [continuation.notice.detail, `Continuation ${turn + 1} of up to ${MAX_CONTINUATION_TURNS}.`].filter(Boolean).join('\n\n'),
        };

      // Continuation checkpoint - client snapshots accumulator state and shows info placeholder
      yield { cg: 'aix-info', ait: 'flow-cont', text: `Continuing (${turn + 1}/${MAX_CONTINUATION_TURNS})...` };

      // -> Loop continues - already-yielded particles are preserved
    }
  }
}
