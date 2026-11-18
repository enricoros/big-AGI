import * as z from 'zod/v4';

import type { DModelParameterValue } from '~/common/stores/llms/llms.parameters';
import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';


// configuration
// [Sarvam, 2026-11-17] Token Factory: Sarvam's own models and open-weight ones on https://api.sarvam.ai/v2, the base URL
// (there is no /v2/v1). GET /v2/models is public and describes each model: this parser reads it and curates nothing.
// The older /v1/models lists ids only (2 models): those rows pass through with the id as the label.
// Not on the listing: prices (INR, https://docs.sarvam.ai/api/getting-started/pricing) and release dates.
// Reasoning rules: https://docs.sarvam.ai/api/token-factory/models#reasoning. The listing agrees with them and with the API,
// except for gemma4: listed as not reasoning, it thinks when sent any effort level - it gets no control here.


export function sarvamHeuristic(hostname: string): boolean {
  return hostname.includes('api.sarvam.ai');
}


// only `id` is required: a field the catalog drops must not empty the service
const _wireSarvamModelSchema = z.object({
  id: z.string(),                             // 'glm5.3-flash' - the request `model`, verbatim
  type: z.string().nullish(),                 // 'chat' | 'decision' (POST /v2/systemone) | 'embedding' (POST /v2/embeddings)
  display_name: z.string().nullish(),         // 'GLM 5.3 Flash'
  owned_by: z.string().nullish(),             // 'sarvam' | 'open-source'
  context_length: z.number().nullish(),
  supports_image_input: z.boolean().nullish(),
  supports_tools: z.boolean().nullish(),      // supports_video_input and supports_audio_input are listed too, not mapped
  beta: z.boolean().nullish(),
  access: z.string().nullish(),               // 'standard': any key | 'provisioned': listed for every key, a 400 unless enabled for the organisation
  reasoning: z.object({                       // null or absent: the model does not reason
    can_disable: z.boolean().nullish(),       // reasoning_effort 'none' turns thinking off
    efforts: z.array(z.string()).nullish(),   // the reasoning_effort levels taken; glm5.3 and glm5.3-flash 400 on any other
  }).nullish(),
  default_parameters: z.object({
    temperature: z.number().nullish(),
    max_tokens: z.number().nullish(),         // the default output budget, reasoning included; more is refused on some models (sarvam-105b at 32768)
  }).nullish(),
});

const _wireSarvamListOutputSchema = z.object({
  data: z.array(_wireSarvamModelSchema),
});

type WireSarvamModel = z.infer<typeof _wireSarvamModelSchema>;


// The levels of llmVndOaiEffort a listing can name, in display order ('none' is not listed: it comes from can_disable).
// Wire-wise the value is sent as `reasoning_effort`, the one field Sarvam reads (the `reasoning` object is a 400).
const _sarvamEffortLevels = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const satisfies readonly DModelParameterValue<'llmVndOaiEffort'>[];

function _sarvamEffortSpecs(reasoning: WireSarvamModel['reasoning']): ModelDescriptionSchema['parameterSpecs'] {
  const listed = reasoning?.efforts ?? [];
  const levels = _sarvamEffortLevels.filter(level => listed.includes(level));
  // a level we cannot name: no control rather than a truncated ladder
  if (levels.length !== listed.length)
    return undefined;
  const enumValues = [...(reasoning?.can_disable ? ['none' as const] : []), ...levels];
  return enumValues.length ? [{ paramId: 'llmVndOaiEffort', enumValues }] : undefined;
}


export function sarvamModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {
  return _wireSarvamListOutputSchema.parse(wireModels).data

    // chat models only: decision and embedding models have their own endpoints, and 404 on chat completions
    .filter(model => !model.type || model.type === 'chat')

    // listing order kept: serverless models first, then the provisioned ones
    .map((model): ModelDescriptionSchema => {

      // listed for every key, but a 400 without the organisation's access: there to unhide, out of the pickers
      const isProvisioned = model.access === 'provisioned';

      const interfaces: DModelInterfaceV1[] = [LLM_IF_OAI_Chat];
      if (model.supports_image_input)
        interfaces.push(LLM_IF_OAI_Vision);
      if (model.supports_tools ?? true) // absent on the ids-only /v1 list: per the docs, every chat model takes tools
        interfaces.push(LLM_IF_OAI_Fn);
      if (model.reasoning)
        interfaces.push(LLM_IF_OAI_Reasoning);

      const parameterSpecs = _sarvamEffortSpecs(model.reasoning);

      const description = [
        model.owned_by === 'open-source' ? 'Open-weight model served by Sarvam.' : 'Sarvam AI model.',
        model.beta ? 'Beta.' : '',
        isProvisioned ? 'Provisioned Throughput: enabled per organisation.' : '',
      ].filter(Boolean).join(' ');

      return {
        id: model.id,
        label: model.display_name || model.id,
        description,
        contextWindow: model.context_length || null,
        interfaces,
        ...(parameterSpecs ? { parameterSpecs } : {}),
        ...(model.default_parameters?.max_tokens ? { maxCompletionTokens: model.default_parameters.max_tokens } : {}),
        ...(typeof model.default_parameters?.temperature === 'number' ? { initialTemperature: model.default_parameters.temperature } : {}),
        ...(isProvisioned ? { hidden: true } : {}),
      };
    });
}
