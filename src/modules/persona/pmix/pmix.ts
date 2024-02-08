import { DLLMId, getKnowledgeMapCutoff } from '~/modules/llms/store-llms';


/**
 * This will be made a module and fully reactive in the future.
 */
export function bareBonesPromptMixer(_template: string, assistantLlmId: DLLMId | undefined) {

  let mixed = _template;

  // {{Today}}
  mixed = mixed.replaceAll('{{Today}}', new Date().toISOString().split('T')[0]);

  // {{Render...}}
  mixed = mixed.replace('{{RenderMermaid}}', 'Mermaid rendering: Enabled');
  mixed = mixed.replace('{{RenderPlantUML}}', 'PlantUML rendering: Enabled');
  mixed = mixed.replace('{{RenderSVG}}', 'SVG rendering: Enabled');

  // {{Input...}} / {{Tool...}} - TBA
  mixed = mixed.replace('{{InputImage0}}', 'Image input capabilities: Disabled');
  mixed = mixed.replace('{{ToolBrowser0}}', 'Web browsing capabilities: Disabled');

  // {{Cutoff}} or remove the line
  const varCutoff = getKnowledgeMapCutoff(assistantLlmId);
  if (varCutoff)
    mixed = mixed.replaceAll('{{Cutoff}}', varCutoff);
  else
    mixed = mixed.replace(/.*{{Cutoff}}.*\n?/g, '');

  // at most leave 2 newlines in a row
  mixed = mixed.replace(/\n{3,}/g, '\n\n');

  return mixed;
}