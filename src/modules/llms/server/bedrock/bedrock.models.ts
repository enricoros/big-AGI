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
import { anthropicInjectVariants, hardcodedAnthropicModels } from '../anthropic/anthropic.models';


// --- Bedrock API Wire Types ---

export namespace BedrockWire_API_Models_List {

  // ListFoundationModels response
  export const FoundationModel_schema = z.object({
    modelId: z.string(),
    modelName: z.string(),
    providerName: z.string(),
    inputModalities: z.array(z.string()),
    outputModalities: z.array(z.string()),
    responseStreamingSupported: z.boolean().optional(),
    inferenceTypesSupported: z.array(z.string()).optional(),
    modelLifecycle: z.object({
      status: z.string(),
    }).optional(),
  });

  export const FoundationModelsResponse_schema = z.object({
    modelSummaries: z.array(FoundationModel_schema),
  });

  // ListInferenceProfiles response
  export const InferenceProfile_schema = z.object({
    inferenceProfileId: z.string(),
    inferenceProfileName: z.string(),
    description: z.string().optional(),
    type: z.string(),
    status: z.string().optional(),
    models: z.array(z.object({
      modelArn: z.string().optional(),
    })).optional(),
  });

  export const InferenceProfilesResponse_schema = z.object({
    inferenceProfileSummaries: z.array(InferenceProfile_schema),
    nextToken: z.string().optional().nullable(),
  });

}


// --- Model ID Mapping ---

/**
 * Maps an Anthropic direct model ID to its Bedrock base model ID.
 * e.g. 'claude-opus-4-6' → 'anthropic.claude-opus-4-6-v1'
 */
const _ANTHROPIC_TO_BEDROCK_MAP: Record<string, string> = {
  'claude-opus-4-6': 'anthropic.claude-opus-4-6-v1',
  'claude-sonnet-4-6': 'anthropic.claude-sonnet-4-6',
  'claude-opus-4-5-20251101': 'anthropic.claude-opus-4-5-20251101-v1:0',
  'claude-sonnet-4-5-20250929': 'anthropic.claude-sonnet-4-5-20250929-v1:0',
  'claude-haiku-4-5-20251001': 'anthropic.claude-haiku-4-5-20251001-v1:0',
  'claude-opus-4-1-20250805': 'anthropic.claude-opus-4-1-20250805-v1:0',
  'claude-opus-4-20250514': 'anthropic.claude-opus-4-20250514-v1:0',
  'claude-sonnet-4-20250514': 'anthropic.claude-sonnet-4-20250514-v1:0',
  'claude-3-7-sonnet-20250219': 'anthropic.claude-3-7-sonnet-20250219-v1:0',
  'claude-3-5-haiku-20241022': 'anthropic.claude-3-5-haiku-20241022-v1:0',
  'claude-3-haiku-20240307': 'anthropic.claude-3-haiku-20240307-v1:0',
};

/**
 * Reverse map: Bedrock base model ID → Anthropic direct model ID.
 * Built from _ANTHROPIC_TO_BEDROCK_MAP. Also includes the full Bedrock model ID
 * with provider prefix stripped, since some appear only as inference profiles.
 */
const _BEDROCK_TO_ANTHROPIC_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(_ANTHROPIC_TO_BEDROCK_MAP).map(([ant, br]) => [br, ant]),
);

/**
 * Convert a Bedrock model ID (with or without region prefix) to its Anthropic equivalent.
 * Returns undefined if not a known Anthropic model.
 *
 * Examples:
 *   'anthropic.claude-opus-4-6-v1'          → 'claude-opus-4-6'
 *   'us.anthropic.claude-opus-4-6-v1'       → 'claude-opus-4-6'
 *   'global.anthropic.claude-opus-4-6-v1'   → 'claude-opus-4-6'
 */
export function bedrockToAnthropicModelId(bedrockModelId: string): string | undefined {
  // Strip region prefix if present (us., eu., global., jp., apac.)
  const baseId = bedrockModelId.replace(/^(us|eu|global|jp|apac)\./, '');
  return _BEDROCK_TO_ANTHROPIC_MAP[baseId];
}

/**
 * Check if a Bedrock model ID is an Anthropic model.
 */
export function isAnthropicBedrockModel(bedrockModelId: string): boolean {
  const baseId = bedrockModelId.replace(/^(us|eu|global|jp|apac)\./, '');
  return baseId.startsWith('anthropic.');
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
  const modelMap = new Map<string, { id: string, label: string, provider: string, isProfile: boolean, streaming: boolean }>();

  // Foundation Models
  for (const fm of foundationModels.modelSummaries) {
    if (fm.modelLifecycle?.status === 'LEGACY') continue;
    // Only include text models that support on-demand inference
    if (!fm.inputModalities?.includes('TEXT') || !fm.outputModalities?.includes('TEXT')) continue;
    modelMap.set(fm.modelId, {
      id: fm.modelId,
      label: fm.modelName,
      provider: fm.providerName,
      isProfile: false,
      streaming: fm.responseStreamingSupported ?? true,
    });
  }

  // Inference Profiles (preferred over foundation models for cross-region routing)
  for (const ip of inferenceProfiles.inferenceProfileSummaries) {
    // Only include active SYSTEM_DEFINED profiles
    if (ip.status && ip.status !== 'ACTIVE') continue;
    modelMap.set(ip.inferenceProfileId, {
      id: ip.inferenceProfileId,
      label: ip.inferenceProfileName,
      provider: _extractProvider(ip.inferenceProfileId),
      isProfile: true,
      streaming: true, // Inference profiles always support streaming
    });
  }

  // Convert to ModelDescriptionSchema, enriching Anthropic models
  const descriptions: ModelDescriptionSchema[] = [];

  for (const [modelId, meta] of modelMap) {
    const anthropicId = bedrockToAnthropicModelId(modelId);

    if (anthropicId) {
      // Known Anthropic model: enrich with hardcoded definitions
      const knownModel = hardcodedAnthropicModels.find(m => m.id === anthropicId);
      if (knownModel) {
        descriptions.push({
          ...knownModel,
          id: modelId, // Use Bedrock model ID
          label: `${knownModel.label} [${_modelPrefix(modelId)}]`,
        });
        continue;
      }
    }

    // Non-Anthropic or unknown Anthropic model: basic description
    const isAnthropic = isAnthropicBedrockModel(modelId);
    descriptions.push({
      id: modelId,
      label: `${meta.label}${meta.isProfile ? ` [${_modelPrefix(modelId)}]` : ''}`,
      description: `${meta.provider} model on AWS Bedrock${isAnthropic ? '' : ' (Converse API)'}`,
      contextWindow: isAnthropic ? 200000 : 32768,
      maxCompletionTokens: isAnthropic ? 64000 : 4096,
      interfaces: isAnthropic
        ? ['oai-chat', 'oai-vision', 'oai-fn', 'ant-prompt-caching']
        : ['oai-chat'],
      // Converse API models get the converse invoke mode
      ...(!isAnthropic ? { hidden: true } : {}),
    });
  }

  // Sort: Anthropic first, then by family/class
  descriptions.sort(_bedrockModelSort);

  // Inject thinking variants for Anthropic models
  return descriptions.reduce(anthropicInjectVariants, []);
}


// --- Helpers ---

/** Extract region prefix from Bedrock model ID */
function _modelPrefix(modelId: string): string {
  const match = modelId.match(/^(us|eu|global|jp|apac)\./);
  return match ? match[1] : 'regional';
}

/** Extract provider name from inference profile ID */
function _extractProvider(profileId: string): string {
  // Format: prefix.provider.model-name → provider
  const parts = profileId.replace(/^(us|eu|global|jp|apac)\./, '').split('.');
  return parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Unknown';
}

/** Sort function: Anthropic first, then by model family */
function _bedrockModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  const aIsAnt = isAnthropicBedrockModel(a.id);
  const bIsAnt = isAnthropicBedrockModel(b.id);
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

  // Prefer global > us > eu > regional
  const prefixOrder = ['global', 'us', 'eu', 'jp', 'apac'];
  const getPrefixIdx = (id: string) => {
    const match = id.match(/^(us|eu|global|jp|apac)\./);
    return match ? prefixOrder.indexOf(match[1]) : 999;
  };
  return getPrefixIdx(a.id) - getPrefixIdx(b.id);
}
