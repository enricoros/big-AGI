/**
 * Prompt Mixer: the clock of a chat, i.e. which instant the date variables of its system instruction render.
 *
 * The system instruction is the prefix of every later request of a chat: one changed byte misses every vendor's prompt
 * cache and, on Anthropic, drops the replayed reasoning. So the date holds while a chat is active, and rolls only after
 * a pause longer than the prompt caches live: Anthropic's lasts 5 minutes from its last use, and after 62 idle minutes
 * OpenAI, Gemini, Moonshot and Mistral were cold (DeepSeek was still warm).
 *
 * Internal to the module: app code imports `promptMixer` (promptMixer.ts).
 */

import type { DMessage } from '~/common/stores/chat/chat.message';
import type { Immutable } from '~/common/types/immutable.types';


/** When the date in a chat's system instruction may change. */
type PromptMixerChatClockPolicy =
  | { roll: 'never' }                         // the date of the chat's first message, for good
  | { roll: 'after-idle', idleMs: number };   // the date of the first user message sent at least idleMs after the chat was last active

export const PROMPT_MIXER_CHAT_CLOCK: PromptMixerChatClockPolicy = { roll: 'after-idle', idleMs: 3_601_000 }; // an hour, and a second past it


/**
 * The `created` of the message that starts the current stretch of activity: the chat's first message, then each user
 * message that follows a pause. A pure function of stored timestamps: as a chat grows, every send in the same stretch
 * renders the same date, on any device in the same time zone, and a regenerate or a branch renders the date its
 * messages had. Deleting the latest messages can move it: the pause is then counted from what is left. Null when the
 * chat has no message yet.
 *
 * - The chat was last active at the latest of its messages' creation times and reply end times: a long generation is
 *   not a pause, and neither is a message whose device clock is behind.
 * - Only a user message starts a stretch. A reply answers a request that was already rendered: if a reply regenerated
 *   after a pause moved the clock, the next send would change the prefix of a request made minutes ago. So a stretch
 *   that begins with a regenerate keeps the earlier date, until a user message follows a pause.
 */
export function promptMixerClock_chatUserMessageAnchor(messages: Immutable<DMessage[]>, policy: PromptMixerChatClockPolicy): number | null {
  let anchor: number | null = null;
  let lastActive = 0;
  for (const { role, created, generator } of messages) {
    if (role === 'system' || !created) continue; // the system message is created at the first send, after the message that caused it
    if (anchor === null || (role === 'user' && policy.roll === 'after-idle' && created - lastActive >= policy.idleMs))
      anchor = created;
    lastActive = Math.max(lastActive, created, generator?.endedAt ?? 0);
  }
  return anchor;
}
