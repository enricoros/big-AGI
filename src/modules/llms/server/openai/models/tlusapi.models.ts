import * as z from 'zod/v4';

import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_Outputs_Audio, LLM_IF_Outputs_Image, LLM_IF_Tools_WebSearch } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';


// -- Wires --

type TlusApiResponse = z.infer<typeof tlusApiResponseSchema>;
type TlusApiModel = TlusApiResponse['data'][number];

const tlusApiResponseSchema = z.object({
  total_models: z.number().optional(),
  free_models: z.number().optional(),
  pro_models: z.number().optional(),
  data: z.array(z.object({
    id: z.string(),
    tier: z.string().optional(),
    description: z.string().optional(),
    capabilities: z.array(z.enum([
      // chat
      'text', 'vision', 'audio', 'tool-calling', 'reasoning', 'agentic', 'websearch', 'roleplay', 'implicit-caching',
      // media generation
      'image-generation', 'image-edit', 'text-to-video', 'image-to-video', 'i2v-only',
      // audio
      'text-to-speech', 'audio-transcription', 'music-generation', 'lyrics',
      // status
      'status:online', 'status:offline',
    ]).or(z.string())),
    context_length: z.union([z.number(), z.literal('N/A')]),
    supports_tools: z.boolean().optional(),
  })),
});


/**
 * Heuristic to detect TLUS-style API responses.
 * Requires: summary counts (free_models, pro_models, total_models) + data array.
 */
export function tlusApiHeuristic(response: unknown): response is TlusApiResponse {
  if (!response || typeof response !== 'object') return false;
  const r = response as Record<string, unknown>;

  // must have summary counts (very distinctive)
  if (typeof r.total_models !== 'number' || typeof r.free_models !== 'number' || typeof r.pro_models !== 'number') return false;

  // must have data array, with a 'tier' field inside
  return Array.isArray(r.data) && r.data.length > 0
    && typeof r.data[0] === 'object' && !!(r.data[0]) && 'tier' in r.data[0];
}


export function tlusApiTryParse(response: unknown): ModelDescriptionSchema[] | null {
  const parsed = tlusApiResponseSchema.safeParse(response);
  if (!parsed.success) return null;

  // [DEV] collect unique capabilities and tiers
  // _tlusApiCollectEnumValues_DEV(parsed.data.data);

  return parsed.data.data
    // .filter(_filterChatModels) // we hide them instead, for now
    .map(_modelToDescription);
  // .sort(_sortModels);
}


// function _tlusApiCollectEnumValues_DEV(models: TlusApiModel[]): void {
//   const capabilities = new Set<string>();
//
//   for (const model of models)
//     for (const cap of model.capabilities || [])
//       capabilities.add(cap);
//
//   console.log('[DEV] TLUS API - unique capabilities:', [...capabilities].sort());
// }


function _filterChatModels(model: TlusApiModel): boolean {
  const caps = model.capabilities || [];
  if (caps.length === 0) return false;

  // exclusion by caps
  const exclusions: string[] = ['status:offline'];
  if (caps.some(c => exclusions.includes(c))) return false;

  // inclusion by caps
  const inclusions = ['text'];
  return caps.some(c => inclusions.includes(c));
}


function _modelToDescription(model: TlusApiModel): ModelDescriptionSchema {
  const caps = model.capabilities || [];

  // label from id
  let label = model.id.endsWith('-Free')
    ? model.id.slice(0, -5).replaceAll('-', ' ') + ' (Free)'
    : model.id;
  label = label.replaceAll('-', ' ');

  // build interfaces from capabilities
  const interfaces: DModelInterfaceV1[] = [LLM_IF_OAI_Chat];
  // inputs
  if (caps.includes('vision')) interfaces.push(LLM_IF_OAI_Vision);
  // outputs
  if (caps.includes('image-generation')) interfaces.push(LLM_IF_Outputs_Image);
  if (caps.includes('audio') || caps.includes('text-to-speech')) interfaces.push(LLM_IF_Outputs_Audio);
  if (caps.includes('tool-calling') || model.supports_tools) interfaces.push(LLM_IF_OAI_Fn, LLM_IF_OAI_Json);
  if (caps.includes('websearch')) interfaces.push(LLM_IF_Tools_WebSearch);
  // other
  if (caps.includes('implicit-caching')) interfaces.push(LLM_IF_OAI_PromptCaching);
  if (caps.includes('reasoning')) interfaces.push(LLM_IF_OAI_Reasoning);

  // context window
  const contextWindow = typeof model.context_length === 'number' ? model.context_length : null;

  // tier - free models get zero pricing
  const isFree = model.tier === 'free';

  return {
    id: model.id,
    label,
    // created: undefined,
    // updated: undefined,
    description: model.description || 'No description provided.',
    contextWindow,
    interfaces,
    // parameterSpecs:
    // maxCompletionTokens: contextWindow ? Math.round(contextWindow / 2) : undefined, // done downstream
    // benchmark
    ...(isFree && { chatPrice: { input: 'free', output: 'free' } }),
    hidden: !_filterChatModels(model),
    // initialTemperature
  };
}


// function _sortModels(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
//   // free models first, then by id
//   const aFree = a.chatPrice?.input === 'free' ? 0 : 1;
//   const bFree = b.chatPrice?.input === 'free' ? 0 : 1;
//   if (aFree !== bFree) return aFree - bFree;
//   return a.id.localeCompare(b.id);
// }
