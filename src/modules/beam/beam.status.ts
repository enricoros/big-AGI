import type { AixChatGenerateTerminal_LL } from '~/modules/aix/client/aix.client';

import { messageOutcomeColor } from '~/common/stores/chat/chat.message.outcome';


/**
 * Status of a Beam item, ray or fusion: the run phase, then the AIX terminal outcome.
 * - 'idle':    never run, or cleared
 * - 'running': generating
 * - AixChatGenerateTerminal_LL: completed (the only success) | truncated | failed | aborted
 */
export type BeamStatus = 'idle' | 'running' | AixChatGenerateTerminal_LL;

/** Joy palette key for a status: terminal outcomes color through messageOutcomeColor, the phases stay uncolored. */
export function beamStatusColor(status: BeamStatus): 'danger' | 'warning' | 'neutral' | undefined {
  return status === 'idle' || status === 'running' ? undefined : messageOutcomeColor[status];
}
