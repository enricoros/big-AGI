/**
 * Prompt Mixer: expands the {{Variables}} of instruction templates.
 *
 * `promptMixer` mixes; the variables, and the lists an editor offers, are in promptMixer.variables.ts.
 * No import here pulls in UI code, so the module loads in a node test.
 */

import { BrowserLang, Is } from '~/common/util/pwaUtils';

import { getChatAutoAI } from '../../apps/chat/store-app-chat';

import { PromptMixerContext, PromptMixerVariables } from './promptMixer.variables';


// configuration
const REMOVE_ALL_LINE_IF_MISSING_LLM = true; // remove all lines if LLM is missing


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

    // validate presence of dependencies
    if (definition.dependencies?.lowHourPrecision && context.lowHourPrecision === undefined) {
      if (REMOVE_ALL_LINE_IF_MISSING_LLM)
        mixed = mixed.replaceAll(new RegExp(`.*${variable}.*\n?`, 'g'), '');
      else
        console.log(`[DEV] promptMixer: skipping ${variable} due to missing lowHourPrecision`);
      continue;
    }

    // get the replacement text
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


// FUTURE: move from global state to contextual state
function _mix(template: string, customFields?: Record<string, string>): string {
  return _render(template, {
    deviceIsDesktop: Is.Desktop,
    deviceBrowserLang: BrowserLang.orUS,
    lowHourPrecision: getChatAutoAI().autoVndAntBreakpoints,
    customFields,
  });
}


export const promptMixer = {

  chat: {
    /** A chat's system instruction. */
    mixInstruction: (template: string): string => _mix(template),
  },

  /**
   * A prompt sent once: a ReAct run, a Beam merge, a preview.
   * @param fields the caller's own placeholders, e.g. { '{{N}}': '3' }
   */
  oneShot: (template: string, fields?: Record<string, string>): string => _mix(template, fields),

} as const;
