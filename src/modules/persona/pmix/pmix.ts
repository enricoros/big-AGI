import { autoFollowUpUIMixin } from '~/modules/aifn/auto-chat-follow-ups/autoChatFollowUps';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import { BrowserLang, Is } from '~/common/util/pwaUtils';

import { getChatAutoAI } from '../../../apps/chat/store-app-chat';

import { PPromptMixerContext, PromptVariableRegistry } from './pmix.parameters';


export function replacePromptVariables(template: string, context: PPromptMixerContext): string {
  let mixed = template;

  // auto-append Auto-Suggest features if enabled
  if (context.fixupAutoSuggestHTMLUI)
    mixed += (mixed.endsWith('\n') ? '' : '\n') + autoFollowUpUIMixin;
  // if (context.autoSuggestDiagrams)
  //   mixed += (mixed.endsWith('\n') ? '' : '\n') + '{{FixupAutoSuggestDiagrams}}';

  // process each variable in the registry
  for (const [variable, definition] of Object.entries(PromptVariableRegistry)) {

    // validate presence of dependencies
    if (definition.dependencies?.assistantLlmId && !context.assistantLlmId) {
      console.warn(`[DEV] replacePromptVariables: skipping ${variable} due to missing LLM ID`);
      continue;
    }
    if (definition.dependencies?.lowHourPrecision && context.lowHourPrecision === undefined) {
      console.warn(`[DEV] replacePromptVariables: skipping ${variable} due to missing lowHourPrecision`);
      continue;
    }

    // get the replacement text or the regex replacement pattern
    const replacementOrNull = definition.replace(context);

    // handle whole-line removal
    if (definition.wholeLine && replacementOrNull === null) {
      mixed = mixed.replaceAll(new RegExp(`.*${variable}.*\n?`, 'g'), '');
      continue;
    }

    // handle pattern-based replacement
    if (definition.pattern) {
      mixed = replacementOrNull === null
        ? mixed.replaceAll(definition.pattern, '')
        : mixed.replaceAll(definition.pattern, replacementOrNull);
      continue;
    }

    // Simple replacement
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
export function bareBonesPromptMixer(_template: string, assistantLlmId: DLLMId | undefined, customFields: Record<string, string> | undefined = undefined) {
  const { autoSuggestHTMLUI, /*autoSuggestDiagrams,*/ autoVndAntBreakpoints } = getChatAutoAI();
  return replacePromptVariables(_template, {
    assistantLlmId,
    deviceIsDesktop: Is.Desktop,
    deviceBrowserLang: BrowserLang.orUS,
    lowHourPrecision: autoVndAntBreakpoints,
    fixupAutoSuggestHTMLUI: autoSuggestHTMLUI,
    customFields,
  });
}
