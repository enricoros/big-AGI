import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';


// [OrcaRouter] URL/host heuristic for OpenAI-compatible detection
export function orcaRouterHeuristic(urlOrHost: string | undefined): boolean {
  return !!urlOrHost && urlOrHost.includes('orcarouter.ai');
}


// Virtual routers (e.g. 'orcarouter/auto') rather than concrete models. On an agentic client that
// always sends `tools`, the auto pool can route to a non-tool upstream and 400, so we keep the
// 'orcarouter/' namespace out of the selectable list. Concrete models keep their upstream prefix
// (e.g. 'openai/gpt-4o-mini'), which OrcaRouter's backend routes on directly.
const _orcaDenyPrefixes = [
  'orcarouter/',
] as const;


/**
 * OrcaRouter is an OpenAI-compatible gateway; GET /v1/models returns provider-prefixed IDs
 * (e.g. 'openai/gpt-4o-mini', 'anthropic/claude-sonnet-4.6') with no display name, context window,
 * or capability flags. We synthesize a readable label and infer interfaces heuristically from the id.
 */
function _orcaRouterModelToModelDescription(model: { id: string; created?: number; owned_by?: string; context_length?: number }): ModelDescriptionSchema | null {
  const id = model?.id;
  if (!id || typeof id !== 'string')
    return null;

  if (_orcaDenyPrefixes.some(prefix => id.startsWith(prefix)))
    return null;

  // Readable label from the provider-prefixed id, e.g. 'openai/gpt-4o-mini' -> 'openai · gpt 4o mini'
  const label = id.replaceAll('/', ' · ').replaceAll(/[_-]/g, ' ');
  const lcId = id.toLowerCase();

  const interfaces: DModelInterfaceV1[] = [LLM_IF_OAI_Chat];

  if (lcId.includes('vision') || lcId.includes('vl') || lcId.includes('gemini'))
    interfaces.push(LLM_IF_OAI_Vision);

  if (lcId.includes('reason') || lcId.includes('think') || lcId.includes('o1') || lcId.includes('o3') || lcId.includes('o4') || lcId.includes('gpt-5'))
    interfaces.push(LLM_IF_OAI_Reasoning);

  if (lcId.includes('json') || lcId.includes('struct') || lcId.includes('gpt-4.1') || lcId.includes('gpt-5'))
    interfaces.push(LLM_IF_OAI_Json);

  // Tools are widely available on modern chat models; exclude only the obvious non-chat types.
  if (!lcId.includes('embed') && !lcId.includes('tts') && !lcId.includes('whisper'))
    interfaces.push(LLM_IF_OAI_Fn);

  const parameterSpecs: ModelDescriptionSchema['parameterSpecs'] = [];
  if (interfaces.includes(LLM_IF_OAI_Reasoning))
    parameterSpecs.push({ paramId: 'llmVndOaiEffort' });

  return {
    id,
    label,
    created: model.created,
    updated: model.created,
    description: model.owned_by ? `Via: ${model.owned_by}` : 'OrcaRouter model',
    contextWindow: model.context_length || null,
    interfaces,
    ...(parameterSpecs.length ? { parameterSpecs } : {}),
  };
}


export function orcaRouterModelsToModelDescriptions(wireModels: { id: string; created?: number; owned_by?: string; context_length?: number }[]): ModelDescriptionSchema[] {
  return wireModels
    .map(_orcaRouterModelToModelDescription)
    .filter((desc): desc is ModelDescriptionSchema => !!desc)
    .sort((a, b) => a.id.localeCompare(b.id));
}
