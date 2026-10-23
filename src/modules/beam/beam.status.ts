import type { AixChatGenerateTerminal_LL } from '~/modules/aix/client/aix.client';


/**
 * Status of a Beam item, ray or fusion: the run phase, then the AIX terminal outcome.
 * - 'idle':    never run, or cleared
 * - 'running': generating
 * - AixChatGenerateTerminal_LL: completed (the only success) | truncated | failed | aborted
 */
export type BeamStatus = 'idle' | 'running' | AixChatGenerateTerminal_LL;
