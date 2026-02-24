import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';


// LLM API is a gateway, so models are dynamic — heuristics determine capabilities

function _llmapiModelLabel(id: string): string {
  // e.g. "gpt-4o-mini" -> "GPT-4o Mini", "claude-3-5-sonnet-20241022" -> "Claude 3.5 Sonnet"
  return id
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function _llmapiModelInterfaces(id: string): ModelDescriptionSchema['interfaces'] {
  const lower = id.toLowerCase();

  const isVision =
    lower.includes('vision') ||
    lower.includes('gpt-4o') ||
    lower.includes('claude-3') ||
    lower.includes('gemini') ||
    lower.includes('pixtral') ||
    lower.includes('llava') ||
    lower.includes('qvq') ||
    lower.includes('vl');

  const isReasoning =
    lower.includes('o1') ||
    lower.includes('o3') ||
    lower.includes('r1') ||
    lower.includes('reasoning') ||
    lower.includes('think') ||
    lower.includes('qwq');

  const interfaces: ModelDescriptionSchema['interfaces'] = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json];

  if (isVision)
    interfaces.push(LLM_IF_OAI_Vision);

  if (isReasoning)
    interfaces.push(LLM_IF_OAI_Reasoning);

  return interfaces;
}

function _llmapiContextWindow(id: string): number {
  const lower = id.toLowerCase();

  if (lower.includes('128k') || lower.includes('claude-3') || lower.includes('gpt-4o') || lower.includes('gemini'))
    return 128000;
  if (lower.includes('32k'))
    return 32768;
  if (lower.includes('16k'))
    return 16384;

  // conservative default for unknown models
  return 8192;
}

export function llmapiModelToModelDescription(model: { id: string; created?: number }): ModelDescriptionSchema {
  const { id, created } = model;
  return {
    id,
    label: _llmapiModelLabel(id),
    ...(created ? { created } : {}),
    description: `LLM API model: ${id}`,
    contextWindow: _llmapiContextWindow(id),
    interfaces: _llmapiModelInterfaces(id),
  };
}

export function llmapiModelsToModelDescriptions(wireModels: { data?: { id: string; created?: number }[] } | null): ModelDescriptionSchema[] {
  if (!wireModels?.data?.length)
    return [];

  return wireModels.data
    .map(model => llmapiModelToModelDescription(model))
    .sort((a, b) => a.id.localeCompare(b.id));
}
