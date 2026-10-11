import { DModelInterfaceV1, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_Outputs_Audio } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { formatPubDate, fromManualMapping, llmsDefineManualMappings } from '../../models.mappings';

// --- Novita Model ID inference (auto-derived from _novitaKnownModels) ---
export type LlmsNovitaModelId = typeof _novitaKnownModels[number]['idPrefix'];
import { wireNovitaListOutputSchema, WireNovitaModel } from '../wiretypes/novita.wiretypes';


export function novitaHeuristic(hostname: string) {
  return hostname.includes('novita.ai');
}


const _novitaKnownModels = llmsDefineManualMappings([
  // NOTE: we don't need manual patching as we have enough info from API
]);

const _novitaDenyListContains: string[] = [
  // OCR models - not chat models
  'paddleocr',
  'deepseek-ocr',
  // internal test/staging rows: status=1 and zero-priced, but absent from the novita.ai/pricing catalog
  // and their /models/llm/<slug> page answers "The requested model could not be found".
  'bunny',
  'dev/glm46',
] as const;


function _prettyModelId(model: WireNovitaModel): string {
  // Use display_name if available, otherwise format id
  if (model.display_name)
    return model.display_name;
  if (model.title)
    return model.title;

  // Format id: "deepseek/deepseek-v3-0324" => "Deepseek V3 0324"
  return model.id
    .replace(/^[^/]+\//, '') // remove vendor prefix like "deepseek/"
    .replaceAll(/[_-]/g, ' ') // replace underscores or dashes with spaces
    .split(' ')
    .map(piece => {
      if (piece.match(/^\d+(\.\d+)*$/)) return piece; // keep version numbers as-is
      if (piece.toLowerCase() === 'ai') return 'AI';
      if (piece.match(/^v\d/i)) return piece.toUpperCase(); // V1, V2, V3
      return piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase();
    })
    .join(' ')
    .trim();
}

/** USD per 1M tokens from hundredths of a cent; 'is_tiered_billing' rows fold their input-length tiers into { upTo, price }[] */
function _novitaTieredPrice(model: WireNovitaModel, field: 'prompt' | 'completion' | 'input_cache_read', flat: number | undefined) {
  const flatUsd = flat === undefined ? undefined : flat / 10000;
  const tiers = model.is_tiered_billing ? model.tiered_billing_configs : undefined;
  if (!tiers?.length) return flatUsd;
  const usd: { upTo: number | null, price: number }[] = [];
  for (const [i, tier] of tiers.entries()) {
    const upTo = i === tiers.length - 1 ? null : tier.max_tokens;
    const price = tier.pricing?.[field]?.price_per_m;
    if (upTo === undefined || price === undefined) return flatUsd;
    usd.push({ upTo, price: price / 10000 });
  }
  return usd.every(t => t.price === usd[0].price) ? usd[0].price : usd;
}


export function novitaModelsToModelDescriptions(wireModels: unknown): ModelDescriptionSchema[] {
  const parsed = wireNovitaListOutputSchema.parse(wireModels);

  return parsed.data
    // Filter out non-chat models and denied models
    .filter((model) => {
      // status=4 marks retired rows (listed in Aug 2026, dropped from the listing since). Only 4 is excluded -
      // an unknown future status stays in.
      if (model.status === 4)
        return false;

      // Only include chat models
      if (model.model_type && model.model_type !== 'chat')
        return false;

      // Skip models without chat endpoints
      if (model.endpoints && !model.endpoints.includes('chat/completions'))
        return false;

      // Apply deny list
      return !_novitaDenyListContains.some(denied => model.id.toLowerCase().includes(denied));
    })

    .map((model): ModelDescriptionSchema => {
      // Label
      const label = _prettyModelId(model);

      // Description
      let description = model.description || '';
      if (description.length > 200)
        description = description.slice(0, 200) + '...';

      // Context window: API value or null, never a guess
      // no '[?]' marker (evaluated 2026-08-14): API-characterized (model_type/endpoints filters) - see llmsLabelUncurated
      const contextWindow = model.context_size || null;

      // Max completion tokens
      const maxCompletionTokens = model.max_output_tokens || undefined;

      // Interfaces
      const interfaces: DModelInterfaceV1[] = [LLM_IF_OAI_Chat];

      // Check features array for capabilities
      const features = model.features || [];
      if (features.includes('function-calling'))
        interfaces.push(LLM_IF_OAI_Fn);
      if (features.includes('reasoning'))
        interfaces.push(LLM_IF_OAI_Reasoning);
      if (features.includes('structured-outputs'))
        interfaces.push(LLM_IF_OAI_Json);

      // Check input modalities for vision
      const inputModalities = model.input_modalities || [];
      if (inputModalities.includes('image'))
        interfaces.push(LLM_IF_OAI_Vision);

      // Check output modalities for audio (e.g., Qwen3 Omni)
      const outputModalities = model.output_modalities || [];
      if (outputModalities.includes('audio'))
        interfaces.push(LLM_IF_Outputs_Audio);

      // Pricing: API returns hundredths of a cent per million tokens, convert to USD per 1M tokens
      // (the internal pricing unit). e.g., 2700 -> $0.27/1M input for deepseek-v3-0324; 700 -> $0.07/1M.
      // Automatic upstream caching: a cache read price gets the informational caching tag.
      const cacheRead = _novitaTieredPrice(model, 'input_cache_read', model.pricing?.input_cache_read?.price_per_m);
      const chatPrice = (model.input_token_price_per_m !== undefined && model.output_token_price_per_m !== undefined)
        ? {
          input: _novitaTieredPrice(model, 'prompt', model.input_token_price_per_m),
          output: _novitaTieredPrice(model, 'completion', model.output_token_price_per_m),
          ...(cacheRead !== undefined && { cache: { read: cacheRead } }),
        }
        : undefined;
      if (chatPrice?.cache)
        interfaces.push(LLM_IF_OAI_PromptCaching);

      const md = fromManualMapping(_novitaKnownModels, model.id, model.created, undefined, {
        idPrefix: model.id,
        label,
        description,
        contextWindow,
        maxCompletionTokens,
        interfaces,
        chatPrice,
        hidden: false,
      });

      // pubDate fallback: Novita's 'created' is its platform listing date - it equals the catalog's
      // 'platform_release_at' on 89 of the 98 rows that publish both (2026-08-17), never the upstream
      // 'model_released_at' - and it is a genuine 2024-2026 spread, not a constant, so it drives the "new"
      // badge for models without an editorial pubDate. Day-0 additions land within days of the real release;
      // a back-catalog add does not (nemotron-3-nano-30b-a3b: listed 2026-06-09, released 2025-12-14).
      // An editorial pubDate (from _novitaKnownModels) always wins.
      if (md.pubDate === undefined && md.created)
        md.pubDate = formatPubDate(md.created);

      return md;
    })

    .sort((a: ModelDescriptionSchema, b: ModelDescriptionSchema): number => {
      // Sort by creation date (newer first), then by id
      if (a.created !== b.created)
        return (b.created || 0) - (a.created || 0);
      return a.id.localeCompare(b.id);
    });
}
