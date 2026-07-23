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

import { llmsAntInjectVariants, llmBedrockFindAnthropicModel, llmBedrockStripAnthropicMDS } from '../anthropic/anthropic.models';
import { LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_Outputs_Audio, LLM_IF_Outputs_Image } from '~/common/stores/llms/llms.types';
import { DModelParameterSpecAny } from '~/common/stores/llms/llms.parameters';


// --- Suppression Rules ---

const SKIP_FM_ID_CONTAINS = ['rerank'];
const SKIP_IP_ID_STARTSWITH = ['stability.'];

// Known Mantle-only models (no matching foundation model) - override heuristics with accurate metadata
const KNOWN_MANTLE_ONLY: Record<string, { label: string; ctx: number; out: number; vision?: true; reasoning?: true }> = {
  'deepseek.v3.1': { label: 'DeepSeek V3.1', ctx: 131072, out: 16384 },
  'moonshotai.kimi-k2-thinking': { label: 'Kimi K2 Thinking', ctx: 131072, out: 16384 },
  'openai.gpt-oss-20b': { label: 'GPT-OSS 20B', ctx: 131072, out: 16384 },
  'openai.gpt-oss-120b': { label: 'GPT-OSS 120B', ctx: 131072, out: 16384 },
  'qwen.qwen3-32b': { label: 'Qwen3 32B', ctx: 131072, out: 16384 },
  'qwen.qwen3-235b-a22b-2507': { label: 'Qwen3 235B A22B', ctx: 131072, out: 16384 },
  'qwen.qwen3-coder-30b-a3b-instruct': { label: 'Qwen3 Coder 30B', ctx: 131072, out: 16384 },
  'qwen.qwen3-coder-480b-a35b-instruct': { label: 'Qwen3 Coder 480B', ctx: 131072, out: 16384 },
  'qwen.qwen3-coder-next': { label: 'Qwen3 Coder Next', ctx: 131072, out: 16384 },
  'qwen.qwen3-next-80b-a3b-instruct': { label: 'Qwen3 Next 80B', ctx: 131072, out: 16384 },
  'qwen.qwen3-vl-235b-a22b-instruct': { label: 'Qwen3 VL 235B', ctx: 131072, out: 16384, vision: true },
  'zai.glm-4.6': { label: 'GLM 4.6', ctx: 131072, out: 16384 },
} as const;


// --- Bedrock API Wire Types ---

/**
 * pubDate reliability on Bedrock (empirically verified 2026-07-04, us-east-1, live API pull).
 *
 * AWS exposes several date fields across the three listing APIs, but NONE is a trustworthy `pubDate`
 * (= earliest public availability of the model by any channel) for third-party models. They all track
 * when AWS ONBOARDED the model to Bedrock - the host-add date - which for hosted models is systematically
 * later than the creator's real release, exactly the case pubDate resolution rule #5 says not to use.
 * Concretely, from a live pull:
 *
 *   - ListFoundationModels -> modelLifecycle.startOfLifeTime (populated on all 66 FMs, NOT captured below):
 *       bulk-clustered onboarding timestamps. 18 unrelated models shared 2025-12-02T00:00:00Z (a re:Invent
 *       drop): Gemma 3 (real release Mar 2025), Kimi-K2-Thinking (Nov 2025), Qwen3-VL, gpt-oss-safeguard...
 *       6 more shared 2026-02-06T18:00:00Z (DeepSeek V3.2, GLM-4.7, Kimi-K2.5...); Mixtral-8x7B -> 2024-03-01
 *       (real Dec 2023). ACCURATE ONLY for AWS-first-party (amazon.nova* -> 2024-12-03, amazon.titan*) and
 *       day-1 co-launch partners (openai.gpt-oss -> 2025-08-06), where onboarding == release because AWS is
 *       the launch channel. (Sibling fields publicExtendedAccessTime/legacyTime/endOfLifeTime are lifecycle
 *       exit markers, not release dates.)
 *   - ListInferenceProfiles -> createdAt/updatedAt (NOT captured below): profile-provisioning date,
 *       region-dependent for the SAME model (claude-sonnet-4 us=2025-05-20 vs global=2025-08-25); updatedAt
 *       is recent housekeeping. Moot for Anthropic anyway - those inherit pubDate from our editorial table.
 *   - Mantle /v1/models -> created (parsed below, intentionally NOT consumed): worst of the three. ~22 models
 *       clustered at 2025-11-30; contradicts the model's own id suffix (openai.gpt-5.4-2026-03-05 -> created
 *       2026-04-30) and disagrees with startOfLifeTime for the same model (zai.glm-5: 2026-03-18 vs 2026-02-22).
 *   - description.releaseDate exists but only on 2/66 models (nova-pro, cohere-embed-v4) - too sparse to use.
 *
 * DECISION: do not fabricate pubDate from any AWS date for non-Anthropic models (would mislabel old models as
 * "new"); Anthropic-on-Bedrock keeps its editorial pubDate (see llmBedrockFindAnthropicModel). The one safe
 * source, if a "new" badge for AWS-first-party models is ever wanted, is startOfLifeTime gated to
 * providerName === 'Amazon' - accurate there because AWS is the model's creator and launch channel.
 */
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
      // NOTE: AWS also sends startOfLifeTime (+ publicExtendedAccessTime/legacyTime/endOfLifeTime), but we
      // only consume `status` - startOfLifeTime is a host-onboarding date, not a release date (see pubDate note above).
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

  // ListMantleModels response (OpenAI-compatible /v1/models from Bedrock Mantle)

  export const MantleModelsResponse_schema = z.object({
    data: z.array(z.object({
      id: z.string(),
      object: z.string().optional(),
      created: z.number().optional(), // parsed but intentionally unused - Bedrock-onboarding date, not a release date (see pubDate note above)
      owned_by: z.string().optional(),
    })),
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
  mantleModels: z.infer<typeof BedrockWire_API_Models_List.MantleModelsResponse_schema>,
): ModelDescriptionSchema[] {

  // Get the IDs for the Mantle models
  const mantleModelIds = new Set(mantleModels.data.map(m => m.id));
  let remainingMantleModelIds = new Set(mantleModelIds); // to track which Mantle models are not matched to foundation/inference profiles

  // Collect unique model definitions from all sources
  const modelMap = new Map<string, {
    id: string;
    label: string;
    provider: string;
    hasMantle: boolean;
    isLegacy: boolean;
    isProfile: boolean;
    streaming: boolean;
    converseMaxTokens: number | null;
    // capabilities detected from FM metadata
    reasoning: boolean;
    inputImage: boolean;
    outputAudio: boolean;
    outputImage: boolean;
  }>();

  // Foundation Models
  for (const fm of foundationModels.modelSummaries) {
    const baseId = fm.modelId; // e.g. 'google.gemma-3-4b-it', 'moonshotai.kimi-k2.5'
    const hasMantle = mantleModelIds.has(baseId);

    // exclusion by pattern
    if (SKIP_FM_ID_CONTAINS.some(s => baseId.includes(s))) continue;

    // excludes non text->text, such as embedding, image gen, video gen, speech-only
    if (!fm.inputModalities?.includes('TEXT') || !fm.outputModalities?.includes('TEXT')) continue;

    modelMap.set(baseId, {
      id: baseId,
      label: fm.modelName,
      provider: fm.providerName,
      hasMantle,
      isLegacy: fm.modelLifecycle?.status === 'LEGACY',
      isProfile: false,
      streaming: fm.responseStreamingSupported ?? true,
      converseMaxTokens: fm.converse?.maxTokensMaximum ?? null,
      reasoning: !!fm.converse?.reasoningSupported?.embedded,
      inputImage: fm.inputModalities?.includes('IMAGE') || !!fm.converse?.userImageTypesSupported?.length,
      outputAudio: fm.outputModalities?.includes('SPEECH') ?? false,
      outputImage: fm.outputModalities?.includes('IMAGE') ?? false,
    });

    // mark as used in mantle
    if (hasMantle)
      remainingMantleModelIds.delete(baseId);
  }

  // Inference Profiles - important to come AFTER the base models, so we can resolve some attributes, if needed
  for (const ip of inferenceProfiles.inferenceProfileSummaries) {
    // exclude legacy models
    if (ip.status && ip.status !== 'ACTIVE') continue;

    // denylist 'start..'
    const baseId = _stripRegionPrefix(ip.inferenceProfileId);
    if (SKIP_IP_ID_STARTSWITH.some(s => baseId.startsWith(s))) continue;
    const hasMantle = mantleModelIds.has(baseId);

    // check if there's a matching foundation model (not anthropic, we map them differently)
    const foundationMeta = modelMap.get(baseId);

    modelMap.set(ip.inferenceProfileId, {
      id: ip.inferenceProfileId,
      label: ip.inferenceProfileName + (foundationMeta ? '' : ' [?]'),
      provider: _extractProvider(ip.inferenceProfileId),
      hasMantle,
      isLegacy: ip.status === 'LEGACY',
      isProfile: true,
      streaming: foundationMeta?.streaming ?? true,
      converseMaxTokens: foundationMeta?.converseMaxTokens ?? null,
      reasoning: foundationMeta?.reasoning ?? false,
      inputImage: foundationMeta?.inputImage ?? false,
      outputAudio: foundationMeta?.outputAudio ?? false,
      outputImage: foundationMeta?.outputImage ?? false,
    });

    // mark as used in mantle
    if (hasMantle)
      remainingMantleModelIds.delete(baseId);
  }


  // Fuse foundationModels + inferenceProfiles into unified ModelDescriptionSchema definitions
  // - Anthropic models get enriched with hardcoded metadata, plus 0-day
  // - non-anthropic models get basic descriptions based on Bedrock metadata, plus mantle/converse markers

  // -> ModelDescriptionSchema[], with Anthropic thinking variants injected inline
  const descriptions: ModelDescriptionSchema[] = [];
  const symbolMantle = ''; // '🐘'; 'Ⓜ️'
  const bedrockAPIAnthropic = { paramId: 'llmVndBedrockAPI', initialValue: 'invoke-anthropic' } as const satisfies DModelParameterSpecAny;
  const bedrockAPIConverse = { paramId: 'llmVndBedrockAPI', initialValue: 'converse' } as const satisfies DModelParameterSpecAny;
  const bedrockAPIMantle = { paramId: 'llmVndBedrockAPI', initialValue: 'mantle' } as const satisfies DModelParameterSpecAny;
  for (const [modelId, modelMeta] of modelMap) {
    if (_seemsAnthropicBedrockModel(modelId)) {

      // Anthropic models
      const antModel = llmBedrockFindAnthropicModel(_stripRegionPrefix(modelId));

      // Known Anthropic: enrich with hardcoded definitions + inject thinking variants
      if (antModel) {
        for (const variant of llmsAntInjectVariants([], antModel))
          descriptions.push(llmBedrockStripAnthropicMDS({ // Filter to the subset of Anthropic params supported
            ...variant,
            id: modelId,
            description: `${variant.description}${modelMeta.isProfile ? ' (Bedrock Inference Profile)' : ' (Bedrock Foundation Model)'}`,
            label: `${modelMeta.isLegacy ? '🕰️ ' : '' /*🅰️*/}${!modelMeta.isProfile ? variant.label : _labelFromProfile(variant.label, modelId)}`,
            parameterSpecs: [...(variant.parameterSpecs || []), bedrockAPIAnthropic], // NOTE: FILTER MUST ALLOW THIS PARAM TOO!
          }));
      }
      // Unknown Anthropic: 0-day model, not in our hardcoded DB
      else {
        descriptions.push({
          id: modelId,
          label: `${modelMeta.isLegacy ? '🕰️ ' : ''}${!modelMeta.isProfile ? modelMeta.label : _labelFromProfile(modelMeta.label, modelId)} [?]`,
          description: `${modelMeta.provider} model ${modelMeta.isProfile ? ' (Bedrock Inference Profile)' : ' (Bedrock Foundation Model)'}`,
          hidden: modelMeta.isLegacy || modelId.includes('.claude-3-'),
          // default assumptions
          contextWindow: 200000,
          maxCompletionTokens: 64000,
          interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
          parameterSpecs: [bedrockAPIAnthropic],
        });
      }

    } else {

      // Non-Anthropic models - may call them via mantle (if hasMantle) or converse (if not legacy)
      const isMantle = modelMeta.hasMantle;
      const isConverseCapable = !modelMeta.isLegacy;
      const interfaces = [LLM_IF_OAI_Chat];
      if (modelMeta.reasoning) interfaces.push(LLM_IF_OAI_Reasoning);
      if (modelMeta.inputImage) interfaces.push(LLM_IF_OAI_Vision);
      if (isConverseCapable && !isMantle) interfaces.push(LLM_IF_OAI_Fn); // Converse models support toolConfig
      if (modelMeta.outputAudio) interfaces.push(LLM_IF_Outputs_Audio);
      if (modelMeta.outputImage) interfaces.push(LLM_IF_Outputs_Image);
      let label = modelMeta.isProfile ? _labelFromProfile(modelMeta.label, modelId) : modelMeta.label;
      const apiLabel = isMantle ? 'OpenAI-Compatible' : isConverseCapable ? 'Converse' : 'Unsupported';
      // no `pubDate`: AWS only offers host-onboarding dates for these third-party models (see pubDate note atop the wire types)
      descriptions.push({
        id: modelId,
        label: `${isMantle || isConverseCapable ? symbolMantle : '🚧 '}${label.startsWith(modelMeta.provider) ? '' : (modelMeta.provider + ' ')}${label}`,
        description: `${modelMeta.provider} model via ${apiLabel} API${modelMeta.isProfile ? ' (Bedrock Inference Profile)' : ' (Bedrock Foundation Model)'}`,
        contextWindow: modelMeta.converseMaxTokens ?? null,
        interfaces,
        parameterSpecs: [isMantle ? bedrockAPIMantle : bedrockAPIConverse],
        hidden: !(isMantle || isConverseCapable), // show if mantle or converse-capable
      });

    }
  }

  // -> Add remaining Mantle-only models (not matched to any FM/IP)
  for (const mantleId of remainingMantleModelIds) {
    const known = KNOWN_MANTLE_ONLY[mantleId];
    const provider = _extractMantleProvider(mantleId);
    const interfaces = [LLM_IF_OAI_Chat];
    if (known?.vision) interfaces.push(LLM_IF_OAI_Vision);
    if (known?.reasoning) interfaces.push(LLM_IF_OAI_Reasoning);
    descriptions.push({
      id: mantleId,
      label: `${symbolMantle}${known?.label ?? labelForMantle(mantleId, provider)}${known ? '' : ' [?]'}`,
      description: `${provider} model via OpenAI-Compatible API on AWS Bedrock Mantle`,
      contextWindow: known?.ctx ?? 131072,
      maxCompletionTokens: known?.out ?? 16384,
      interfaces,
      parameterSpecs: [bedrockAPIMantle],
      hidden: true, // we know it can run, but we don't have models details
    });
  }

  return descriptions.sort(_bedrockModelSort);
}


// --- Helpers ---

// Extract provider name from Mantle model ID (e.g., 'mistral.model-name' -> 'Mistral')
function _extractMantleProvider(modelId: string): string {
  const parts = modelId.split('.');
  return !parts[0] ? 'Unknown' : parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
}

// Build a display label from a Mantle model ID
function labelForMantle(modelId: string, provider: string): string {
  const parts = modelId.split('.');
  const modelPart = parts.slice(1).join('.') || modelId;
  // clean up: remove common suffixes, improve readability
  const cleanLabel = modelPart
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  return `${provider} ${cleanLabel}`;
}

/** Build a profile label: strip redundant region prefix from name, append `· Region` suffix (omit for global) */
function _labelFromProfile(name: string, modelId: string): string {
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

/** Sort: Anthropic first, then non-Anthropic by provider > label */
function _bedrockModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  const aId = _stripRegionPrefix(a.id);
  const bId = _stripRegionPrefix(b.id);
  const aIsAnt = _seemsAnthropicBedrockModel(aId);
  const bIsAnt = _seemsAnthropicBedrockModel(bId);
  if (aIsAnt !== bIsAnt) return aIsAnt ? -1 : 1;

  // --- Non-Anthropic: 🚧-prefixed labels last, then provider, then label ---
  if (!aIsAnt)
    return (a.label.startsWith('🚧') ? 1 : 0) - (b.label.startsWith('🚧') ? 1 : 0)
      || _extractMantleProvider(aId).localeCompare(_extractMantleProvider(bId))
      || a.label.localeCompare(b.label);

  // --- Anthropic: family > class > variant > region ---
  const familyPrecedence: string[][] = [
    ['-fable-5', '-mythos-5', '-opus-5', '-sonnet-5', '-haiku-5'], // Claude 5 gen
    ['-4-8'], ['-4-7'], ['-4-6'], ['-4-5-'], ['-4-1-'], ['-4-'], ['-3-7-'], ['-3-5-'], ['-3-'],
  ];
  const classPrecedence = ['-fable-', '-mythos-', '-opus-', '-sonnet-', '-haiku-'];

  const getFamilyIdx = (id: string) => familyPrecedence.findIndex(fam => fam.some(f => id.includes(f)));
  const getClassIdx = (id: string) => classPrecedence.findIndex(c => id.includes(c));

  const familyA = getFamilyIdx(aId);
  const familyB = getFamilyIdx(bId);
  if (familyA !== familyB) return (familyA === -1 ? 999 : familyA) - (familyB === -1 ? 999 : familyB);

  const classA = getClassIdx(aId);
  const classB = getClassIdx(bId);
  if (classA !== classB) return (classA === -1 ? 999 : classA) - (classB === -1 ? 999 : classB);

  // Thinking/adaptive variants before plain
  const aIsVariant = !!a.idVariant;
  const bIsVariant = !!b.idVariant;
  if (aIsVariant !== bIsVariant) return aIsVariant ? -1 : 1;

  // Prefer global > us > eu > regional
  const prefixOrder = ['global', 'us', 'eu', 'jp', 'apac'];
  const getPrefixIdx = (id: string) => {
    const prefix = _extractRegionPrefix(id);
    return prefix ? prefixOrder.indexOf(prefix) : 999;
  };
  return getPrefixIdx(a.id) - getPrefixIdx(b.id);
}
