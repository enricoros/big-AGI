import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';


// [llmman] Models are whatever the user has pulled locally, so ids are not from
// a fixed catalog and no manual mapping table applies. Served locally, so free.
const _llmmanPrice = { input: 'free', output: 'free' } as const;


export function llmmanModelSortFn(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  return a.label.localeCompare(b.label);
}

export function llmmanModelToModelDescription(modelId: string): ModelDescriptionSchema {
  const label = modelId;

  // Very dull heuristics, matching how the other local vendors infer capabilities
  // from an id, since the server reports no capability metadata.
  const lowerId = modelId.toLowerCase();
  const interfaces = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn];
  if (['vision', 'llava', '-vl-', 'minicpm-v'].some(match => lowerId.includes(match)))
    interfaces.push(LLM_IF_OAI_Vision);
  if (['r1', 'thinking', 'reasoning', 'qwq'].some(match => lowerId.includes(match)))
    interfaces.push(LLM_IF_OAI_Reasoning);

  return {
    id: modelId,
    label,
    created: 0,
    description: `Local model served by llmman. Id: ${modelId}`,
    contextWindow: null, // not reported
    interfaces,
    chatPrice: _llmmanPrice,
  };
}
