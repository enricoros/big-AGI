import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';


const _orcaDenyPrefixes = [
  'orcarouter/',
] as const;

export function orcaRouterModelToModelDescription(model: { id: string; created?: number; owned_by?: string; [key: string]: any }): ModelDescriptionSchema | null {
  const id = model?.id;
  if (!id || typeof id !== 'string')
    return null;

  if (_orcaDenyPrefixes.some(prefix => id.startsWith(prefix)))
    return null;

  // Keep labels explicit and readable, avoid unknown fallback marker "[?]".
  const label = id.replaceAll('/', ' · ').replaceAll(/[_-]/g, ' ');

  const interfaces = [LLM_IF_OAI_Chat];
  const lcId = id.toLowerCase();

  if (lcId.includes('vision') || lcId.includes('vl') || lcId.includes('gemini'))
    interfaces.push(LLM_IF_OAI_Vision);

  if (lcId.includes('reason') || lcId.includes('think') || lcId.includes('o1') || lcId.includes('o3') || lcId.includes('o4') || lcId.includes('gpt-5'))
    interfaces.push(LLM_IF_OAI_Reasoning);

  const parameterSpecs: ModelDescriptionSchema['parameterSpecs'] = [];

  if (interfaces.includes(LLM_IF_OAI_Reasoning))
    parameterSpecs.push({ paramId: 'llmVndOaiEffort' });

  if (lcId.includes('json') || lcId.includes('struct') || lcId.includes('gpt-4.1') || lcId.includes('gpt-5'))
    interfaces.push(LLM_IF_OAI_Json);

  // Tools support is widely available on modern chat models; keep broad but safe heuristic.
  if (!lcId.includes('embed') && !lcId.includes('tts') && !lcId.includes('whisper'))
    interfaces.push(LLM_IF_OAI_Fn);

  return {
    id,
    label,
    created: model.created,
    updated: model.created,
    description: model.owned_by ? `Via: ${model.owned_by}` : 'OrcaRouter model',
    contextWindow: null,
    interfaces,
    ...(parameterSpecs.length ? { parameterSpecs } : {}),
  };
}

export function orcaRouterModelSortFn(a: { id: string }, b: { id: string }): number {
  return a.id.localeCompare(b.id);
}
