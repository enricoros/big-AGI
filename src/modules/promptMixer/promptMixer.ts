/**
 * Prompt Mixer: expands the {{Variables}} of instruction templates.
 *
 * `promptMixer` mixes; the variables, and the lists an editor offers, are in promptMixer.variables.ts.
 * No import here pulls in UI code, so the module loads in a node test.
 */

import type { DMessage } from '~/common/stores/chat/chat.message';
import type { Immutable } from '~/common/types/immutable.types';
import { Is } from '~/common/util/pwaUtils';

import { PromptMixerContext, PromptMixerVariables } from './promptMixer.variables';
import { PROMPT_MIXER_CHAT_CLOCK, promptMixerClock_chatUserMessageAnchor } from './promptMixer.clock';


function _render(template: string, context: PromptMixerContext): string {
  let mixed = template;

  // Remove deprecated variables: templates at rest may still carry them. First, so what the caller fills in is left as it is
  // - {{LLM.Cutoff}} - deprecated on 2026-01-29; not used, maybe back to gpt-4, but then we could just update those prompts (whole line removal)
  mixed = mixed.replaceAll(/.*\{\{LLM\.Cutoff}}.*\n/g, '');
  // - {{LLM.LowRL:text}} - the token with its text; a line that held only the token goes too
  mixed = mixed.replaceAll(/^[ \t]*\{\{LLM\.LowRL:[\s\S]*?}}[ \t]*\r?\n?/gm, '');
  mixed = mixed.replaceAll(/\{\{LLM\.LowRL:[\s\S]*?}}/g, '');

  // process each variable in the registry
  for (const [variable, definition] of Object.entries(PromptMixerVariables)) {
    const replacementOrNull = definition.replace(context);
    if (replacementOrNull !== null)
      mixed = mixed.replaceAll(variable, () => replacementOrNull);
  }

  // Handle custom fields - replaced by a function, as a string would have its '$' sequences read as patterns
  if (context.customFields)
    for (const [placeholder, replacement] of Object.entries(context.customFields))
      mixed = mixed.replaceAll(placeholder, () => replacement);

  // At most leave 2 newlines in a row
  mixed = mixed.replace(/\n{3,}/g, '\n\n');

  return mixed;
}


export const promptMixer = {

  chat: {
    /**
     * A chat's system instruction. Date variables render the chat clock, so the text is the same on every send
     * until the date rolls (promptMixer.clock.ts).
     * @param messages the chat the instruction is for
     */
    mixInstruction: (template: string, messages: Immutable<DMessage[]>): string => _render(template, {
      clock: promptMixerClock_chatUserMessageAnchor(messages, PROMPT_MIXER_CHAT_CLOCK) ?? Date.now(), // a chat with no message yet: now
      deviceIsDesktop: Is.Desktop,
    }),
  },

  /**
   * A prompt sent once: a ReAct run, a Beam merge, a preview. Date variables render now.
   * @param fields the caller's own placeholders, e.g. { '{{N}}': '3' }
   */
  oneShot: (template: string, fields?: Record<string, string>): string => _render(template, {
    clock: Date.now(),
    deviceIsDesktop: Is.Desktop,
    customFields: fields,
  }),

} as const;
