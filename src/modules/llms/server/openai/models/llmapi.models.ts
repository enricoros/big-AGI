import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_Outputs_Audio, LLM_IF_Outputs_Image } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from '../../models.mappings';
import { wireLlmApiListOutputSchema, type WireLlmApiModel } from '../wiretypes/llmapi.wiretypes';


// configuration
// [LLMAPI, 2026-02-25] NOTE: all the following mappings are based from today's https://api.llmapi.ai/v1/models


export function llmapiHeuristic(hostname: string): boolean {
  return hostname.includes('.llmapi.ai');
}


const _llmapiKnownModels: ManualMappings = [
  // NOTE: dynamic-only for now, no manual patching needed
] as const;

const _llmapiDenyIds: string[] = [
  'custom',   // llmapi internal routing meta-model
  'auto',     // llmapi internal routing meta-model
] as const;

function _llmapiModelFilter(model: WireLlmApiModel): boolean {
  // deny listed meta-models
  if (_llmapiDenyIds.includes(model.id))
    return false;

  // skip deprecated or deactivated models
  if (model.deprecated_at || model.deactivated_at) return false;
  // skip non-chat models: no text output at all
  // if (!model.architecture.output_modalities.includes('text')) return false;
  // skip safety/guard models
  // if (model.id.includes('llama-guard')) return false;
  // skip image-only models (very small context, image in name, no chat use)
  // if (model.id.includes('cogview') || model.id.includes('qwen-image')) return false;

  return true;
}


export function llmapiModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {
  return wireLlmApiListOutputSchema.parse(wireModels).data

    .filter(_llmapiModelFilter)

    .map((model): ModelDescriptionSchema => {

      const noStreaming = model.providers[0]?.streaming === false;
      const label = noStreaming ? `🚧 ${model.name}` : model.name;
      const providerNames = model.providers.map(p => p.providerId).join(', ');
      const description = providerNames ? `Via: ${providerNames}` : model.description;
      const contextWindow = model.context_length || null;

      // capabilities: derive from the first provider entry (authoritative per-model flags)
      const provider = model.providers[0];
      const interfaces: DModelInterfaceV1[] = [LLM_IF_OAI_Chat];
      if (provider?.vision || model.architecture.input_modalities.includes('image'))
        interfaces.push(LLM_IF_OAI_Vision);
      if (provider?.tools)
        interfaces.push(LLM_IF_OAI_Fn);
      if (provider?.reasoning)
        interfaces.push(LLM_IF_OAI_Reasoning);
      if (model.json_output || model.structured_outputs)
        interfaces.push(LLM_IF_OAI_Json);
      if (model.architecture.output_modalities.includes('image'))
        interfaces.push(LLM_IF_Outputs_Image);
      if (model.architecture.output_modalities.includes('audio'))
        interfaces.push(LLM_IF_Outputs_Audio);

      // effort parameter: if the model supports 'effort' or 'reasoning_effort'
      const parameterSpecs: ModelDescriptionSchema['parameterSpecs'] = [];
      if (model.supported_parameters.includes('effort')) // seems to only be applied on Anthropic for now
        parameterSpecs.push({ paramId: 'llmVndAntEffort' });

      // pricing: per-token dollar strings -> $/M tokens (the chatPrice unit)
      const promptPerToken = parseFloat(model.pricing.prompt);
      const completionPerToken = parseFloat(model.pricing.completion);
      const perImage = parseFloat(model.pricing.image);
      const perRequest = parseFloat(model.pricing.request);
      const inputPriceM = promptPerToken * 1_000_000;
      const outputPriceM = completionPerToken * 1_000_000;
      const isFreePriced = inputPriceM === 0 && outputPriceM === 0 && perImage === 0 && perRequest === 0;
      // if (model.free !== isFreePriced)
      //   console.warn(`Model ${model.id} has inconsistent free flag vs pricing`, model);
      const isFree = model.free || isFreePriced;
      const chatPrice = isFree
        ? { input: 'free' as const, output: 'free' as const }
        : { input: inputPriceM, output: outputPriceM };

      return fromManualMapping(_llmapiKnownModels, model.id, model.created, undefined, {
        idPrefix: model.id,
        label,
        description,
        contextWindow,
        interfaces,
        ...(parameterSpecs.length ? { parameterSpecs } : {}),
        chatPrice,
        hidden: noStreaming,
      });
    })

    .sort((a: ModelDescriptionSchema, b: ModelDescriptionSchema): number => {
      // split id into family prefix (first word) and the rest
      // e.g. "claude-opus-4-1-20250805" -> family="claude", rest="opus-4-1-20250805"
      const aDash = a.id.indexOf('-');
      const bDash = b.id.indexOf('-');
      const aFamily = aDash > 0 ? a.id.slice(0, aDash) : a.id;
      const bFamily = bDash > 0 ? b.id.slice(0, bDash) : b.id;
      const aRest = aDash > 0 ? a.id.slice(aDash + 1) : '';
      const bRest = bDash > 0 ? b.id.slice(bDash + 1) : '';

      // family ascending, then rest descending (newest/highest versions first)
      const familyCmp = aFamily.localeCompare(bFamily);
      if (familyCmp !== 0)
        return familyCmp;
      return bRest.localeCompare(aRest);
    });
}
