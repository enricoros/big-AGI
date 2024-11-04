import { autoFollowUpUIMixin } from '~/modules/aifn/auto-chat-follow-ups/autoChatFollowUps';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import { BrowserLang, Is } from '~/common/util/pwaUtils';
import { findLLMOrThrow } from '~/common/stores/llms/store-llms';

import { getChatAutoAI } from '../../../apps/chat/store-app-chat';

/*type Variables =
  | '{{Today}}'
  | '{{Cutoff}}'
  | '{{PreferTables}}'
  | '{{RenderMermaid}}'
  | '{{RenderPlantUML}}'
  | '{{RenderSVG}}'
  | '{{InputImage0}}'
  | '{{ToolBrowser0}}';

type VariableResolverContext = {
  assistantLlmId: DLLMId;
};

const variableResolvers: { [key in Variables]: (context: VariableResolverContext) => string } = {
  '{{Today}}': () => {
    const today = new Date();
    return today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  },
  '{{Cutoff}}': (context) => {
    return getKnowledgeMapCutoff(context.assistantLlmId) || '';
  },

  '{{PreferTables}}': () => 'Data presentation: prefer tables (auto-columns)',
  '{{RenderMermaid}}': () => 'Mermaid rendering: Enabled',
  '{{RenderPlantUML}}': () => 'PlantUML rendering: Enabled',
  '{{RenderSVG}}': () => 'SVG rendering: Enabled',

  '{{InputImage0}}': () => 'Image input capabilities: Disabled',

  '{{ToolBrowser0}}': () => 'Web browsing capabilities: Disabled',
};*/


/**
 * This will be made a module and fully reactive in the future.
 * NOTE: think twice before changing the variables, as they can be in data at rest (can they?)
 */
export function bareBonesPromptMixer(_template: string, assistantLlmId: DLLMId | undefined, customFields: Record<string, string> | undefined = undefined) {

  let mixed = _template;

  // If Auto-Follow-Ups are enabled, forcefully add text
  const { autoSuggestHTMLUI, autoSuggestDiagrams, autoVndAntBreakpoints } = getChatAutoAI();
  if (autoSuggestHTMLUI)
    mixed += (mixed.endsWith('\n') ? '' : '\n') + '{{AutoSuggestHTMLUI}}';
  // if (autoSuggestDiagrams)
  //   mixed += (mixed.endsWith('\n') ? '' : '\n') + '{{AutoSuggestDiagrams}}';

  // {{Today}} - yyyy-mm-dd but in user's local time, not UTC
  const today = new Date();
  const varToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  mixed = mixed.replaceAll('{{Today}}', varToday);

  // {{LocaleNow}} - enough information to get on the same page with the user
  if (mixed.includes('{{LocaleNow}}')) {
    // const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    // Format the current date and time according to the user's locale and timezone
    const formatter = new Intl.DateTimeFormat(BrowserLang.orUS, {
      weekday: 'short', // Full name of the day of the week
      year: 'numeric', // Numeric year
      month: 'short', // Full name of the month
      day: 'numeric', // Numeric day of the month
      hour: '2-digit', // 2-digit hour
      // NOTE: disable the minutes if we are using auto-breakpoints, as this will invalidate all every minute...
      minute: autoVndAntBreakpoints ? undefined : '2-digit', // 2-digit minute
      timeZoneName: 'short', // Short timezone name (e.g., GMT, CST)
      hour12: true, // Use 12-hour time format; set to false for 24-hour format if preferred
    });
    const formattedDateTime = formatter.format(new Date());
    mixed = mixed.replaceAll('{{LocaleNow}}', formattedDateTime /*`${formattedDateTime} (${userTimezone})`*/);
  }

  // Static replacements
  // {{Prefer...}}
  mixed = mixed.replace('{{PreferTables}}', 'Data presentation: prefer tables (auto-columns)');
  // {{Render...}}
  mixed = mixed.replace('{{RenderMermaid}}', 'Mermaid rendering: Enabled for diagrams and pie charts and no other charts');
  mixed = mixed.replace('{{RenderPlantUML}}', 'PlantUML rendering: Enabled');
  mixed = mixed.replace('{{RenderHTML}}', `HTML in markdown rendering: Sleek HTML5 for ${Is.Desktop ? 'desktop' : 'mobile'} screens (self-contained with CSS/JS, leverage top libraries, external links OK)`);
  mixed = mixed.replace('{{RenderSVG}}', 'SVG in markdown rendering: Enabled');
  // {{Input...}} / {{Tool...}} - TBA
  mixed = mixed.replace('{{InputImage0}}', 'Image input capabilities: Disabled');
  mixed = mixed.replace('{{ToolBrowser0}}', 'Web browsing capabilities: Disabled');
  // {{AutoSuggest...}}
  mixed = mixed.replace('{{AutoSuggestHTMLUI}}', autoFollowUpUIMixin);
  // mixed = mixed.replace('{{AutoSuggestDiagrams}}', suggestDiagramMixin);

  // {{Cutoff}} or remove the line
  let varCutoff: string | undefined;
  try {
    if (assistantLlmId)
      varCutoff = findLLMOrThrow(assistantLlmId).trainingDataCutoff;
  } catch (e) {
    // ignore...
  }
  if (varCutoff)
    mixed = mixed.replaceAll('{{Cutoff}}', varCutoff);
  else
    mixed = mixed.replaceAll(/.*{{Cutoff}}.*\n?/g, '');

  // {{LowRL:...}} - remove the line if the model is a reasoning model
  if (mixed.includes('{{LowRL:')) {

    // Remove line for reasoning models
    const removeLineForDLLMIDs = [
      '-claude-3-5', '-claude-3-opus',    // [Anthropic]
      '-deepseek-chat',                   // [DeepSeek]
      '-gemini-1.5',                      // [Google]
      '-mistral-large',                   // [Mistral]
      '-o1-', '-gpt-4o', '-gpt-4-turbo',  // [OpenAI]
    ];
    const shallRemoveLine = !assistantLlmId ? false : removeLineForDLLMIDs.some(model => assistantLlmId.includes(model));

    // Regular expression to match all {{LowRL:...}} placeholders
    const lqRegex = /{{LowRL:(.*?)}}/gs;

    if (!shallRemoveLine) {
      // Include the content inside {{LowRL:...}} for other models
      mixed = mixed.replaceAll(lqRegex, '$1');
    } else
      mixed = mixed.replaceAll(lqRegex, '');
  }

  // Handle custom fields
  if (customFields)
    for (const [placeholder, replacement] of Object.entries(customFields))
      mixed = mixed.replaceAll(placeholder, replacement);

  // At most leave 2 newlines in a row
  mixed = mixed.replace(/\n{3,}/g, '\n\n');

  return mixed;
}