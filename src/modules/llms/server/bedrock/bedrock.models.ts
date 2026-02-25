/**
 * Bedrock model definitions and ID mapping.
 *
 * Bedrock model IDs differ from Anthropic direct API IDs:
 *   - Anthropic direct: 'claude-opus-4-6'
 *   - Bedrock foundation: 'anthropic.claude-opus-4-6-v1'
 *   - Bedrock inference profile: 'us.anthropic.claude-opus-4-6-v1' / 'global.anthropic.claude-opus-4-6-v1'
 *
 * For non-Anthropic models (via Converse API), models are identified by their
 * Bedrock model IDs directly.
 */

import * as z from 'zod/v4';

import type { ModelDescriptionSchema } from '../llm.server.types';

import { anthropicInjectVariants, llmBedrockFindAnthropicModel, llmBedrockStripAnthropicMDS } from '../anthropic/anthropic.models';
import { LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';


// --- Bedrock API Wire Types ---

export namespace BedrockWire_API_Models_List {

  // ListFoundationModels response

  const _FoundationModel_schema = z.object({
    modelId: z.string(),
    modelName: z.string(),
    providerName: z.enum(['Amazon', 'Anthropic', 'Cohere', 'DeepSeek', 'Google', 'Luma AI', 'Meta', 'MiniMax', 'Mistral AI', 'Moonshot AI', 'NVIDIA', 'OpenAI', 'Qwen', 'Stability AI', 'Z.AI']).or(z.string()),
    inputModalities: z.array(z.enum(['TEXT', 'IMAGE', 'EMBEDDING', 'VIDEO', 'SPEECH']).or(z.string())),
    outputModalities: z.array(z.enum(['TEXT', 'IMAGE', 'EMBEDDING', 'VIDEO', 'SPEECH']).or(z.string())),
    responseStreamingSupported: z.boolean().nullable().optional(),
    inferenceTypesSupported: z.array(z.enum(['ON_DEMAND', 'INFERENCE_PROFILE', 'PROVISIONED']).or(z.string())).optional(),
    modelLifecycle: z.object({
      status: z.enum(['ACTIVE', 'LEGACY']).or(z.string()),
    }).optional(),
    // Converse API metadata (present on newer models, null on legacy)
    converse: z.object({
      maxTokensMaximum: z.number().nullable().optional(),
      reasoningSupported: z.object({
        embedded: z.boolean(),
      }).nullable().optional(),
      systemRoleSupported: z.boolean().optional(),
      userImageTypesSupported: z.array(z.enum(['png', 'jpeg', 'gif', 'webp']).or(z.string())).optional(),
    }).nullable().optional(),
  });

  export const FoundationModelsResponse_schema = z.object({
    modelSummaries: z.array(_FoundationModel_schema),
  });

  // ListInferenceProfiles response

  const _InferenceProfile_schema = z.object({
    inferenceProfileId: z.string(),
    inferenceProfileName: z.string(),
    description: z.string().optional(),
    type: z.enum(['SYSTEM_DEFINED', 'APPLICATION']).or(z.string()),
    status: z.enum(['ACTIVE', 'LEGACY']).or(z.string()).optional(),
    models: z.array(z.object({
      modelArn: z.string().optional(),
    })).optional(),
  });

  export const InferenceProfilesResponse_schema = z.object({
    inferenceProfileSummaries: z.array(_InferenceProfile_schema),
    nextToken: z.string().optional().nullable(),
  });

}


// --- Model ID Helpers ---

const _REGION_PREFIX_RE = /^(us|eu|global|jp|apac)\./;

/** Strip region prefix (us., global., etc.) from a Bedrock model ID, returning a bedrockBaseId */
function _stripRegionPrefix(bedrockModelId: string): string {
  return bedrockModelId.replace(_REGION_PREFIX_RE, '');
}

/** Extract region prefix (us, global, etc.) or undefined if none */
function _extractRegionPrefix(bedrockModelId: string): string | undefined {
  return _REGION_PREFIX_RE.exec(bedrockModelId)?.[1];
}

/** Check if a Bedrock model ID is an Anthropic model */
function _seemsAnthropicBedrockModel(bedrockModelId: string): boolean {
  return _stripRegionPrefix(bedrockModelId).startsWith('anthropic.');
}


// --- Model Description Building ---

/**
 * Convert Bedrock model listings into ModelDescriptionSchema[].
 * Enriches known Anthropic models with hardcoded definitions.
 * Non-Anthropic models get basic descriptions with Converse API marker.
 */
export function bedrockModelsToDescriptions(
  foundationModels: z.infer<typeof BedrockWire_API_Models_List.FoundationModelsResponse_schema>,
  inferenceProfiles: z.infer<typeof BedrockWire_API_Models_List.InferenceProfilesResponse_schema>,
): ModelDescriptionSchema[] {

  // Collect unique model IDs from both sources
  const modelMap = new Map<string, {
    id: string;
    label: string;
    provider: string;
    isInferenceProfile: boolean;
    streaming: boolean;
    converseMaxTokens: number | null;
    converseImageTypes: string[]
  }>();

  // Foundation Models
  for (const fm of foundationModels.modelSummaries) {
    // exclude legacy models
    if (fm.modelLifecycle?.status === 'LEGACY') continue;

    // excludes embedding, image gen, video gen, speech-only
    if (!fm.inputModalities?.includes('TEXT') || !fm.outputModalities?.includes('TEXT')) continue;

    // denylist '..match..'
    if (['rerank'].some(match => fm.modelId.includes(match))) continue;

    modelMap.set(fm.modelId, {
      id: fm.modelId,
      label: fm.modelName,
      provider: fm.providerName,
      isInferenceProfile: false,
      streaming: fm.responseStreamingSupported ?? true,
      converseMaxTokens: fm.converse?.maxTokensMaximum ?? null,
      converseImageTypes: fm.converse?.userImageTypesSupported ?? [],
    });
  }

  // Inference Profiles
  for (const ip of inferenceProfiles.inferenceProfileSummaries) {
    // exclude legacy models
    if (ip.status && ip.status !== 'ACTIVE') continue;

    // denylist 'start..'
    const baseId = _stripRegionPrefix(ip.inferenceProfileId);
    if (['stability.'].some(start => baseId.startsWith(start))) continue;

    // check if there's a matching foundation model (not anthropic, we map them differently)
    const foundationMeta = modelMap.get(baseId);
    // if (!_seemsAnthropicBedrockModel(ip.inferenceProfileId) && !foundationMeta)
    //   console.log('[Bedrock] No matching foundation model for inference profile', ip.inferenceProfileId);

    modelMap.set(ip.inferenceProfileId, {
      id: ip.inferenceProfileId,
      label: ip.inferenceProfileName,
      provider: _extractProvider(ip.inferenceProfileId),
      isInferenceProfile: true,
      streaming: foundationMeta?.streaming ?? true,
      converseMaxTokens: foundationMeta?.converseMaxTokens ?? null,
      converseImageTypes: foundationMeta?.converseImageTypes ?? [],
    });
  }

  // -> ModelDescriptionSchema[], with Anthropic thinking variants injected inline
  const descriptions: ModelDescriptionSchema[] = [];
  for (const [modelId, meta] of modelMap) {

    // Known Anthropic models: enrich with hardcoded definitions + inject thinking variants
    const antModel = llmBedrockFindAnthropicModel(_stripRegionPrefix(modelId));
    if (antModel) {
      const isProfile = !!_extractRegionPrefix(modelId);
      // Inject variants (returns [variant, base] or [base] if no variant)
      const withVariants = anthropicInjectVariants([], antModel);
      for (const variant of withVariants) {
        const label = isProfile ? _profileLabel(variant.label, modelId) : variant.label;
        descriptions.push({ ...variant, id: modelId, label });
      }
      continue;
    }

    // Unknown models - these will NOT be accessible, hence the '🚧'. We show them just in case, but maybe we shall not
    const isAnthropic = _seemsAnthropicBedrockModel(modelId);
    const hasVision = meta.converseImageTypes.length > 0;
    descriptions.push({
      id: modelId,
      label: '🚧 ' + (meta.isInferenceProfile ? _profileLabel(meta.label, modelId) : meta.label),
      description: `${meta.provider} model on AWS Bedrock${isAnthropic ? '' : ' (Converse API)'}`,
      contextWindow: isAnthropic ? 200000 : (meta.converseMaxTokens ? meta.converseMaxTokens * 2 : 32768),
      maxCompletionTokens: isAnthropic ? 64000 : (meta.converseMaxTokens ?? 4096),
      interfaces:
        isAnthropic ? [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching]
          : hasVision ? [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision]
            : [LLM_IF_OAI_Chat],
      hidden: true, // not in our known models DB — hide until verified usable
    });
  }

  // Filter interfaces and params to Bedrock-supported subset, then sort
  const filtered = descriptions.map(llmBedrockStripAnthropicMDS);
  filtered.sort(_bedrockModelSort);
  return filtered;
}


// --- Helpers ---

/** Build a profile label: strip redundant region prefix from name, append `· Region` suffix (omit for global) */
function _profileLabel(name: string, modelId: string): string {
  const prefix = _extractRegionPrefix(modelId) ?? 'regional';
  // Strip leading "US ", "GLOBAL ", etc. from the AWS-provided name
  const cleanName = name.replace(/^(US|EU|GLOBAL|JP|APAC)\s+/i, '');
  // if (prefix === 'global') return cleanName;
  // Display-friendly casing: US, EU, Global, etc.
  const displayPrefix = prefix === 'global' ? 'Global' : prefix.toUpperCase();
  // return `${cleanName} [${displayPrefix}]`;
  return `${cleanName} · ${displayPrefix}`;
}

/** Extract provider name from inference profile ID */
function _extractProvider(profileId: string): string {
  // Format: region.provider.model-name -> Provider
  const parts = _stripRegionPrefix(profileId).split('.');
  return parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Unknown';
}

/** Sort: Anthropic first, then family > class > variant (thinking before plain) > region */
function _bedrockModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  const aIsAnt = _seemsAnthropicBedrockModel(a.id);
  const bIsAnt = _seemsAnthropicBedrockModel(b.id);
  if (aIsAnt && !bIsAnt) return -1;
  if (!aIsAnt && bIsAnt) return 1;

  // Within Anthropic: sort by family precedence
  const familyPrecedence = ['-4-7-', '-4-6', '-4-5-', '-4-1-', '-4-', '-3-7-', '-3-5-', '-3-'];
  const classPrecedence = ['-opus-', '-sonnet-', '-haiku-'];

  const getFamilyIdx = (id: string) => familyPrecedence.findIndex(f => id.includes(f));
  const getClassIdx = (id: string) => classPrecedence.findIndex(c => id.includes(c));

  const familyA = getFamilyIdx(a.id);
  const familyB = getFamilyIdx(b.id);
  if (familyA !== familyB) return (familyA === -1 ? 999 : familyA) - (familyB === -1 ? 999 : familyB);

  const classA = getClassIdx(a.id);
  const classB = getClassIdx(b.id);
  if (classA !== classB) return (classA === -1 ? 999 : classA) - (classB === -1 ? 999 : classB);

  // Thinking/adaptive variants before plain (idVariant present = variant)
  const aIsVariant = !!a.idVariant;
  const bIsVariant = !!b.idVariant;
  if (aIsVariant && !bIsVariant) return -1;
  if (!aIsVariant && bIsVariant) return 1;

  // Prefer global > us > eu > regional
  const prefixOrder = ['global', 'us', 'eu', 'jp', 'apac'];
  const getPrefixIdx = (id: string) => {
    const prefix = _extractRegionPrefix(id);
    return prefix ? prefixOrder.indexOf(prefix) : 999;
  };
  return getPrefixIdx(a.id) - getPrefixIdx(b.id);
}
