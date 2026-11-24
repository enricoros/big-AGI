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
  | { roll: 'after-idle', idleMs: number }    // the date of the first message or send at least idleMs after the chat was last active
  | { roll: 'always' };                       // the date of each send: the prefix changes whenever the hour does

export const PROMPT_MIXER_CHAT_CLOCK: PromptMixerChatClockPolicy = { roll: 'after-idle', idleMs: 3_601_000 }; // an hour, and a second past it


/**
 * The instant the date variables of a chat render for a send at `now`, under a policy.
 *
 * With 'after-idle' it is when the current stretch of activity started: the chat's first message, then each message
 * that follows a pause, and the send itself when it follows one. A send leaves its instant in the message it creates
 * (the user message it sends, or the reply a regenerate creates as its request starts), so every later send of the
 * stretch derives the same date from stored timestamps, on any device in the same time zone.
 *
 * - The chat was last active at the latest of its messages' creation times and reply end times: a long generation is
 *   not a pause, and neither is a message whose device clock is behind.
 * - A regenerate after a pause is a send like a new message, with no warm cache to keep, so a reply can start a
 *   stretch too. It is created a few milliseconds after the render: an hour turning in between moves the date once.
 * - Only stored messages are seen, so activity that left none reads as a pause: the messages a send deletes first (a
 *   regenerate, a restart from an earlier message) and a Beam's rays until a reply is accepted. The date then moves
 *   once, also in a chat active a minute ago, at one cache miss.
 */
export function promptMixerClock_chatInstant(messages: Immutable<DMessage[]>, now: number, policy: PromptMixerChatClockPolicy): number {
  if (policy.roll === 'always') return now;
  const idleMs = policy.roll === 'after-idle' ? policy.idleMs : Infinity; // 'never': no pause is long enough
  let anchor: number | null = null;
  let lastActive = 0;
  for (const { role, created, generator } of messages) {
    if (role === 'system' || !created) continue; // the system message is created at the first send, after the message that caused it
    if (anchor === null || created - lastActive >= idleMs)
      anchor = created;
    lastActive = Math.max(lastActive, created, generator?.endedAt ?? 0);
  }
  // now: no message yet, or a send after a pause that adds none before it renders (a regenerate)
  return anchor === null || now - lastActive >= idleMs ? now : anchor;
}
