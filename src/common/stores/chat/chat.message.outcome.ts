import { DMessageFragment, isContentFragment, isErrorPart } from './chat.fragments';
import type { DMessage } from './chat.message';


/**
 * Terminal outcome of a generated message - the one classification every surface and predicate derives from.
 * The LL outcome (AixChatGenerateTerminal_LL) is this same type: the reassembler derives it from the final message.
 * - 'completed': success - the only one
 * - 'truncated': out of tokens - an error typed apart from 'failed', so it renders as warning rather than danger
 * - 'failed':    error - stop reason 'issue' or 'filter', or a trailing error fragment on a message without a stop reason
 * - 'aborted':   stopped by the user - neither success nor error
 */
export type DMessageTerminalOutcome = 'completed' | 'truncated' | 'failed' | 'aborted';

/** The terminal outcome, or 'pending' while the message is still generating. */
export type DMessageOutcome = DMessageTerminalOutcome | 'pending';

/** What the outcome is derived from: a DMessage, or an accumulator with readonly fragments (the reassembler) */
type MessageOutcomeSource = Pick<DMessage, 'generator' | 'pendingIncomplete'> & { fragments: readonly DMessageFragment[] };


// configuration

/**
 * Policy per outcome, read by automation instead of re-decided per site:
 * - rerun:  an automatic re-run makes sense (Beam 'Start all', auto-retry, future chaining); a manual Retry is always available
 * - cost:   what a re-run buys: 'none' (nothing to run), 'repeat' (same cap, same cut, same bill), 'new' (a fresh attempt can end differently)
 * - usable: the output stands as a complete answer (Use, continue to chat); merge inputs still follow the content rule, see #1216
 */
export const messageOutcomePolicy = {
  completed: { rerun: false, cost: 'none', usable: true },
  truncated: { rerun: false, cost: 'repeat', usable: false },
  failed: { rerun: true, cost: 'new', usable: false },
  aborted: { rerun: true, cost: 'new', usable: false },
  pending: { rerun: false, cost: 'none', usable: false },
} as const satisfies Record<DMessageOutcome, { rerun: boolean; cost: 'none' | 'repeat' | 'new'; usable: boolean }>;


// derivation

export function messageOutcome(message: MessageOutcomeSource): DMessageOutcome {
  return message.pendingIncomplete ? 'pending' : messageTerminalOutcome(message);
}

export function messageTerminalOutcome(message: Omit<MessageOutcomeSource, 'pendingIncomplete'>): DMessageTerminalOutcome {
  switch (message.generator?.tokenStopReason) {
    case 'out-of-tokens':
      return 'truncated';
    case 'issue':
    case 'filter':
      return 'failed';
    case 'client-abort':
      return 'aborted';
    case undefined:
      break;
    default:
      return 'failed'; // forward-compat: a stop reason this build does not know is not a success
  }
  // no stop reason (pre-stop-reason messages, clean ends without a finish reason): the last content fragment decides; trailing void notices do not weigh in
  for (let i = message.fragments.length - 1; i >= 0; i--) {
    const fragment = message.fragments[i];
    if (isContentFragment(fragment))
      return isErrorPart(fragment.part) ? 'failed' : 'completed';
  }
  return 'completed';
}


// presentation

/** Outcome -> Joy palette key. Truncation is an error typed apart: warning, not danger. A user stop is neutral on Beam cards (#1070); chat bubbles tint truncation only. Beam cards, chat backgrounds, notices and tables color from this. */
export const messageOutcomeColor = {
  completed: undefined,
  truncated: 'warning',
  failed: 'danger',
  aborted: 'neutral',
  pending: undefined,
} as const satisfies Record<DMessageOutcome, 'danger' | 'warning' | 'neutral' | undefined>;

/** Outcome -> user-facing label. One wording per outcome; null when there is nothing to say. */
export const messageOutcomeLabel = {
  completed: null,
  truncated: 'Out of tokens',
  failed: 'Error',
  aborted: 'Stopped',
  pending: null,
} as const satisfies Record<DMessageOutcome, string | null>;
