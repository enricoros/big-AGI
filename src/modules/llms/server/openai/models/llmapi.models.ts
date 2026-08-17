import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_Outputs_Audio, LLM_IF_Outputs_Image } from '~/common/stores/llms/llms.types';
import type { DModelParameterValue } from '~/common/stores/llms/llms.parameters';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, llmsDefineManualMappings } from '../../models.mappings';

// --- LLMAPI Model ID inference (auto-derived from _llmapiKnownModels) ---
export type LlmsLlmApiModelId = typeof _llmapiKnownModels[number]['idPrefix'];
import { wireLlmApiListOutputSchema, type WireLlmApiModel } from '../wiretypes/llmapi.wiretypes';


// configuration
// [LLMAPI, 2026-08-17] NOTE: all the following mappings are based on today's https://api.llmapi.ai/v1/models.
// 389 listed -> 354 live (deny + deprecated/deactivated) -> 142 chat (text output, chat-ish family); of those,
// 142 carry a context window, 141 a released_at pubDate, and 46 a reasoning_levels effort ladder.
// no '[?]' marker: the modality + family filter below characterizes the model type - see llmsLabelUncurated.


export function llmapiHeuristic(hostname: string): boolean {
  return hostname.includes('.llmapi.ai');
}


const _llmapiKnownModels = llmsDefineManualMappings([
  // NOTE: dynamic-only for now, no manual patching needed
]);

const _llmapiDenyIds: string[] = [
  'custom',   // llmapi internal routing meta-model
  'auto',     // llmapi internal routing meta-model
] as const;

// Families that are not chat, even when they emit text. 'video'/'image'/'tts' are already excluded by the
// output-modality test; 'stt'/'streaming-stt' are not - transcription outputs text but takes no chat turn.
const _llmapiNonChatFamilies: string[] = [
  'video',
  'image',
  'tts',
  'stt',
  'streaming-stt',
] as const;

// The full llmVndOaiEffort ladder: a model's 'reasoning_levels' is published only if every level is one of these.
const _llmapiEffortLevels = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const satisfies readonly DModelParameterValue<'llmVndOaiEffort'>[];

function _llmapiIsEffortLevel(level: string): level is (typeof _llmapiEffortLevels)[number] {
  return _llmapiEffortLevels.some(known => known === level);
}

function _llmapiModelFilter(model: WireLlmApiModel): boolean {
  // deny listed meta-models
  if (_llmapiDenyIds.includes(model.id))
    return false;

  // skip deprecated or deactivated models
  if (model.deprecated_at || model.deactivated_at) return false;
  // skip non-chat models: no text output at all (video, image, audio, embeddings)
  if (!model.architecture.output_modalities.includes('text')) return false;
  // skip the text-emitting non-chat families (transcription)
  if (model.family && _llmapiNonChatFamilies.includes(model.family)) return false;

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
      if (provider?.json_output || provider?.structured_outputs)
        interfaces.push(LLM_IF_OAI_Json);
      if (model.architecture.output_modalities.includes('image'))
        interfaces.push(LLM_IF_Outputs_Image);
      if (model.architecture.output_modalities.includes('audio'))
        interfaces.push(LLM_IF_Outputs_Audio);

      // effort parameter: 'reasoning_levels' is the vendor's own per-model ladder and supersedes the coarse
      // supported_parameters 'effort' flag (6 models, every one of which also carries a ladder). All-or-nothing:
      // an unrecognized level means we do not know the ladder, so publish no spec rather than a truncated one.
      // Wire-wise these collapse to `reasoning_effort` on the openai dialect, same as the old llmVndAntEffort.
      const parameterSpecs: ModelDescriptionSchema['parameterSpecs'] = [];
      const effortLevels = model.reasoning_levels?.filter(_llmapiIsEffortLevel) ?? [];
      if (effortLevels.length && effortLevels.length === model.reasoning_levels?.length)
        parameterSpecs.push({ paramId: 'llmVndOaiEffort', enumValues: effortLevels });
      else if (model.supported_parameters?.includes('effort'))
        parameterSpecs.push({ paramId: 'llmVndOaiEffort' });

      // pricing: per-token dollar strings -> $/M tokens (the chatPrice unit); image/request are rare, absent = 0
      const promptPerToken = parseFloat(model.pricing.prompt);
      const completionPerToken = parseFloat(model.pricing.completion);
      const perImage = parseFloat(model.pricing.image ?? '0');
      const perRequest = parseFloat(model.pricing.request ?? '0');
      const inputPriceM = promptPerToken * 1_000_000;
      const outputPriceM = completionPerToken * 1_000_000;
      const isFreePriced = inputPriceM === 0 && outputPriceM === 0 && perImage === 0 && perRequest === 0;
      // if (model.free !== isFreePriced)
      //   console.warn(`Model ${model.id} has inconsistent free flag vs pricing`, model);
      const isFree = model.free || isFreePriced;
      const chatPrice = isFree
        ? { input: 'free' as const, output: 'free' as const }
        : { input: inputPriceM, output: outputPriceM };

      // pubDate: 'released_at' is the upstream model release date, not the gateway listing date ('created'),
      // so it is a real "new model" signal.
      const releasedAt = model.released_at;
      const pubDate = releasedAt && /^\d{4}-\d{2}-\d{2}$/.test(releasedAt) ? releasedAt.replaceAll('-', '') : undefined;

      return fromManualMapping(_llmapiKnownModels, model.id, model.created, undefined, {
        idPrefix: model.id,
        label,
        description,
        contextWindow,
        interfaces,
        ...(parameterSpecs.length ? { parameterSpecs } : {}),
        chatPrice,
        pubDate,
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
