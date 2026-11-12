import { BrowserLang, Is } from '~/common/util/pwaUtils';

import { getChatAutoAI } from '../../apps/chat/store-app-chat';

import { PPromptMixerContext, PromptVariableRegistry } from './promptMixer.variables';


// configuration
const REMOVE_ALL_LINE_IF_MISSING_LLM = true; // remove all lines if LLM is missing


export function replacePromptVariables(template: string, context: PPromptMixerContext): string {
  let mixed = template;

  // Remove deprecated variables: templates at rest may still carry them. First, so what the caller fills in is left as it is
  // - {{LLM.Cutoff}} - deprecated on 2026-01-29; not used, maybe back to gpt-4, but then we could just update those prompts (whole line removal)
  mixed = mixed.replaceAll(/.*\{\{LLM\.Cutoff}}.*\n/g, '');
  // - {{LLM.LowRL:text}} - the token with its text; a line that held only the token goes too
  mixed = mixed.replaceAll(/^[ \t]*\{\{LLM\.LowRL:[\s\S]*?}}[ \t]*\r?\n?/gm, '');
  mixed = mixed.replaceAll(/\{\{LLM\.LowRL:[\s\S]*?}}/g, '');

  // process each variable in the registry
  for (const [variable, definition] of Object.entries(PromptVariableRegistry)) {

    // validate presence of dependencies
    if (definition.dependencies?.lowHourPrecision && context.lowHourPrecision === undefined) {
      if (REMOVE_ALL_LINE_IF_MISSING_LLM)
        mixed = mixed.replaceAll(new RegExp(`.*${variable}.*\n?`, 'g'), '');
      else
        console.log(`[DEV] replacePromptVariables: skipping ${variable} due to missing lowHourPrecision`);
      continue;
    }

    // get the replacement text
    const replacementOrNull = definition.replace(context);
    if (replacementOrNull !== null)
      mixed = mixed.replaceAll(variable, replacementOrNull);
  }

  // Handle custom fields
  if (context.customFields)
    for (const [placeholder, replacement] of Object.entries(context.customFields))
      mixed = mixed.replaceAll(placeholder, replacement);

  // At most leave 2 newlines in a row
  mixed = mixed.replace(/\n{3,}/g, '\n\n');

  return mixed;
}


/**
 * This will be made a module and fully reactive in the future.
 * NOTE: think twice before changing the variables, as they can be in data at rest (can they?)
 */
export function bareBonesPromptMixer(_template: string, customFields: Record<string, string> | undefined = undefined) {
  const { autoVndAntBreakpoints } = getChatAutoAI();
  return replacePromptVariables(_template, {
    deviceIsDesktop: Is.Desktop,
    deviceBrowserLang: BrowserLang.orUS,
    lowHourPrecision: autoVndAntBreakpoints,
    customFields,
  });
}
