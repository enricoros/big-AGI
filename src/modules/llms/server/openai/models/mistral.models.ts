import * as z from 'zod/v4';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { llmDevCheckModels_DEV } from '../../models.mappings';


// configuration
const DEV_DEBUG_MISTRAL_MODELS = Release.IsNodeDevBuild; // not in staging to reduce noise


// [Mistral]
// Updated 2026-08-17
// - models on: https://docs.mistral.ai/models/overview (cards moved to /models/<slug>)
// - pricing on: https://docs.mistral.ai/inference/pricing (now server-rendered; cards carry the same numbers)
// - benchmark elo on CBA
// - prompt caching: the pricing table publishes a 'Cached input' rate (10% of input) for every priced row, modeled below as cache.read;
//   it is opt-in, not automatic (2026-08-17 probe on mistral-small-latest, 32617-token prompt: 3 identical requests without
//   'prompt_cache_key' all returned cached_tokens=0, the same prompt with the key returned cached_tokens=32592), and AIX does not
//   send 'prompt_cache_key' yet - so the rate is inert until it does, and correct the moment it starts

type _MistralModelDef = {
  label?: string; // override the API-provided name
  pubDate: string; // YYYYMMDD - earliest public availability (announcement / La Plateforme / HF upload)
  chatPrice?: { input: number; output: number; cache?: { cType: 'oai-ac', read: number } };
  benchmark?: { cbaElo: number };
  hidden?: boolean;
};

const _knownMistralModelDetails: Record<string, _MistralModelDef> = {

  // Premier models - Mistral 3 (Dec 2025)
  'mistral-large-2512': { pubDate: '20251202', chatPrice: { input: 0.5, output: 1.5, cache: { cType: 'oai-ac', read: 0.05 } }, benchmark: { cbaElo: 1415 } }, // Mistral Large 3 - MoE 41B active / 675B total (leaderboard: mistral-large-3 = 1415)
  'mistral-large-latest': { pubDate: '20251202', chatPrice: { input: 0.5, output: 1.5, cache: { cType: 'oai-ac', read: 0.05 } }, hidden: true }, // → 2512

  'mistral-medium-2604': { label: 'Mistral Medium (2604)', pubDate: '20260428', chatPrice: { input: 1.5, output: 7.5, cache: { cType: 'oai-ac', read: 0.15 } }, benchmark: { cbaElo: 1427 } }, // Mistral Medium 3.5 - frontier-class multimodal, adjustable reasoning (reasoning_effort: none|high), Modified MIT (leaderboard: mistral-medium-3.5 = 1427)
  'mistral-medium-2508': { pubDate: '20250812', chatPrice: { input: 0.4, output: 2 }, benchmark: { cbaElo: 1409 }, hidden: true }, // Mistral Medium 3.1 (retires 2026-08-31)
  'mistral-medium-2505': { pubDate: '20250507', chatPrice: { input: 0.4, output: 2 }, benchmark: { cbaElo: 1387 }, hidden: true }, // Mistral Medium 3 (retires 2026-08-31)
  'mistral-medium-latest': { pubDate: '20260428', chatPrice: { input: 1.5, output: 7.5, cache: { cType: 'oai-ac', read: 0.15 } }, hidden: true }, // → 2604
  'mistral-medium': { pubDate: '20260428', chatPrice: { input: 1.5, output: 7.5, cache: { cType: 'oai-ac', read: 0.15 } }, hidden: true }, // → 2604 (the legacy 2312 prototype ID was reassigned)
  'mistral-medium-3-5': { pubDate: '20260428', chatPrice: { input: 1.5, output: 7.5, cache: { cType: 'oai-ac', read: 0.15 } }, hidden: true }, // → 2604
  'mistral-medium-3.5': { pubDate: '20260428', chatPrice: { input: 1.5, output: 7.5, cache: { cType: 'oai-ac', read: 0.15 } }, hidden: true }, // → 2604
  'mistral-medium-3': { pubDate: '20260428', chatPrice: { input: 1.5, output: 7.5, cache: { cType: 'oai-ac', read: 0.15 } }, hidden: true }, // → 2604
  'mistral-vibe-cli-latest': { pubDate: '20260428', chatPrice: { input: 1.5, output: 7.5, cache: { cType: 'oai-ac', read: 0.15 } }, hidden: true }, // → 2604 (Vibe CLI alias)
  'mistral-vibe-cli-with-tools': { pubDate: '20260428', chatPrice: { input: 1.5, output: 7.5, cache: { cType: 'oai-ac', read: 0.15 } }, hidden: true }, // → 2604 (Vibe CLI alias)

  'devstral-2512': { label: 'Devstral 2 (2512)', pubDate: '20251209', chatPrice: { input: 0.4, output: 2 }, hidden: true }, // Devstral 2 - 123B coding agents (deprecated, retires 2026-08-31 → Mistral Medium 3.5)
  'devstral-latest': { label: 'Devstral 2 (latest)', pubDate: '20251209', chatPrice: { input: 0.4, output: 2 }, hidden: true }, // symlink
  'devstral-medium-latest': { label: 'Devstral 2 (latest)', pubDate: '20251209', chatPrice: { input: 0.4, output: 2 }, hidden: true }, // symlink
  'mistral-code-agent-latest': { label: 'Devstral 2 (latest)', pubDate: '20251209', chatPrice: { input: 0.4, output: 2 }, hidden: true }, // alternate ID for devstral-latest

  'codestral-2508': { pubDate: '20250730', chatPrice: { input: 0.3, output: 0.9, cache: { cType: 'oai-ac', read: 0.03 } } }, // code generation (Codestral 25.08)
  'codestral-latest': { pubDate: '20250730', chatPrice: { input: 0.3, output: 0.9, cache: { cType: 'oai-ac', read: 0.03 } }, hidden: true }, // symlink
  'mistral-code-latest': { pubDate: '20250730', chatPrice: { input: 0.3, output: 0.9, cache: { cType: 'oai-ac', read: 0.03 } }, hidden: true }, // symlink
  'mistral-code-fim-latest': { pubDate: '20250730', chatPrice: { input: 0.3, output: 0.9, cache: { cType: 'oai-ac', read: 0.03 } }, hidden: true }, // symlink

  'voxtral-small-2507': { pubDate: '20250715', chatPrice: { input: 0.1, output: 0.4 } }, // voice (text tokens; audio input billed $0.004/min, not modeled)
  'voxtral-small-latest': { pubDate: '20250715', chatPrice: { input: 0.1, output: 0.4 }, hidden: true }, // symlink

  // Ministral 3 family (Dec 2025) - multimodal, multilingual, Apache 2.0
  'ministral-14b-2512': { pubDate: '20251202', chatPrice: { input: 0.2, output: 0.2, cache: { cType: 'oai-ac', read: 0.02 } } }, // Ministral 3 14B
  'ministral-14b-latest': { pubDate: '20251202', chatPrice: { input: 0.2, output: 0.2, cache: { cType: 'oai-ac', read: 0.02 } }, hidden: true }, // symlink

  'ministral-8b-2512': { pubDate: '20251202', chatPrice: { input: 0.15, output: 0.15, cache: { cType: 'oai-ac', read: 0.015 } } }, // Ministral 3 8B
  'ministral-8b-latest': { pubDate: '20251202', chatPrice: { input: 0.15, output: 0.15, cache: { cType: 'oai-ac', read: 0.015 } }, hidden: true }, // symlink

  'ministral-3b-2512': { pubDate: '20251202', chatPrice: { input: 0.1, output: 0.1, cache: { cType: 'oai-ac', read: 0.01 } } }, // Ministral 3 3B
  'ministral-3b-latest': { pubDate: '20251202', chatPrice: { input: 0.1, output: 0.1, cache: { cType: 'oai-ac', read: 0.01 } }, hidden: true }, // symlink

  // Open models
  'mistral-small-2603': { pubDate: '20260316', chatPrice: { input: 0.15, output: 0.6, cache: { cType: 'oai-ac', read: 0.015 } } }, // Mistral Small 4 - 119B hybrid (instruct+reasoning+coding), 256k ctx, reasoning_effort: none|high
  'mistral-small-latest': { pubDate: '20260316', chatPrice: { input: 0.15, output: 0.6, cache: { cType: 'oai-ac', read: 0.015 } }, hidden: true }, // → 2603
  'magistral-small-latest': { pubDate: '20260316', chatPrice: { input: 0.15, output: 0.6, cache: { cType: 'oai-ac', read: 0.015 } }, hidden: true }, // → 2603 (the Magistral Small line was folded into Small 4)
  'mistral-vibe-cli-fast': { pubDate: '20260316', chatPrice: { input: 0.15, output: 0.6, cache: { cType: 'oai-ac', read: 0.015 } }, hidden: true }, // → 2603 (Vibe CLI alias)

  'labs-leanstral-1-5-1': { label: 'Leanstral 1.5', pubDate: '20260630', chatPrice: { input: 0, output: 0 } }, // Lean 4 formal proof engineering, Small 4 derivative (Labs, free, retires 2026-09-30)
  'labs-leanstral-1-5': { pubDate: '20260630', chatPrice: { input: 0, output: 0 }, hidden: true }, // symlink

  // Third-party hosted - Mistral serves the model unmodified (docs id is 'zai-glm-5-2', listed 2026-08-06)
  'zai-glm-5-2': { label: 'Z.ai GLM 5.2', pubDate: '20260616', chatPrice: { input: 1.4, output: 4.4, cache: { cType: 'oai-ac', read: 0.14 } }, benchmark: { cbaElo: 1471 - 2 } }, // 1M ctx, 128k max output (lmarena: glm-5.2-max - 2, yield to native vendor)
  'glm-5-2': { pubDate: '20260616', chatPrice: { input: 1.4, output: 4.4, cache: { cType: 'oai-ac', read: 0.14 } }, hidden: true }, // -> zai-glm-5-2

  // Legacy (kept for reference, no longer in API)
  'open-mistral-7b': { pubDate: '20230927', chatPrice: { input: 0.25, output: 0.25 }, hidden: true },
};


const mistralModelFamilyOrder = [
  // Mistral 3 (Dec 2025)
  'mistral-large-2512',   // Mistral Large 3 - specific prefix must come before generic 'mistral-large'
  'ministral-14b',
  'ministral-8b',
  'ministral-3b',
  // Premier
  'magistral-medium',
  'mistral-medium',
  'mistral-vibe-cli',     // alternate IDs for Mistral Medium 3.5 (except '-fast', matched by exact ID below)
  'devstral-2512',        // Devstral 2 - must come before generic 'devstral'
  'mistral-code-agent',   // alternate ID for Devstral 2 - must come before 'mistral-code'
  'devstral-medium',
  'mistral-large-pixtral', // Pixtral Large uses 'mistral-large-pixtral-2411' ID - must come before 'mistral-large'
  'pixtral-large',
  'mistral-large',        // Generic fallback for other mistral-large variants
  'codestral',
  'mistral-code',         // alternate IDs for Codestral
  'magistral-small',
  'mistral-small',
  'mistral-vibe-cli-fast', // Mistral Small 4 (exact ID: takes precedence over the 'mistral-vibe-cli' prefix above)
  'labs-mistral-small-creative', // Mistral Small Creative (Labs) - must come after mistral-small
  'labs-devstral-small-2512', // Devstral Small 2 (Labs) - must come before generic prefixes
  'devstral-small',
  'labs-leanstral', // Leanstral (Labs) - Lean 4 formal proof engineering
  'voxtral-small',
  'voxtral-mini',
  'mistral-embed',
  'mistral-ocr',
  'codestral-embed',
  'mistral-moderation',
  // Open
  'open-codestral-mamba',
  'pixtral-12b',
  'open-mistral-nemo',
  // Third-party hosted
  'zai-glm',
  'glm-',
  // Legacy (no longer in API, kept for fallback)
  'open-mistral-7b',
  // Deprecated
  'mistral-tiny',
  // Symlinks at the bottom
  '🔗',
];


function _mistralModelsSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  if (a.label.startsWith('🔗') && !b.label.startsWith('🔗')) return 1;
  if (!a.label.startsWith('🔗') && b.label.startsWith('🔗')) return -1;
  let aIndex = mistralModelFamilyOrder.findIndex(id => a.id === id);
  if (aIndex === -1)
    aIndex = mistralModelFamilyOrder.findIndex(prefix => a.id.startsWith(prefix));
  let bIndex = mistralModelFamilyOrder.findIndex(id => b.id === id);
  if (bIndex === -1)
    bIndex = mistralModelFamilyOrder.findIndex(prefix => b.id.startsWith(prefix));
  if (aIndex !== -1 && bIndex !== -1) {
    if (aIndex !== bIndex)
      return aIndex - bIndex;
    return b.label.localeCompare(a.label);
  }
  return aIndex !== -1 ? 1 : -1;
}


function _prettyMistralName(name: string): string {
  return name
    // .replace(/^(mistral|codestral|pixtral|magistral|ministral|devstral)-/, '')
    .replace(/-(2\d{3})$/, ' ($1)')
    .replace(/-(latest|embed)$/, ' ($1)')
    .replaceAll(/[_-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function _mistralCapabilitiesToInterfaces(capabilities: WireMistralModel['capabilities'], modelId: string) {
  // everyone gets Chat
  const interfaces = [LLM_IF_OAI_Chat];
  if (!capabilities || capabilities.function_calling)
    interfaces.push(LLM_IF_OAI_Fn);
  if (!capabilities || capabilities.vision)
    interfaces.push(LLM_IF_OAI_Vision);
  // if (!capabilities || capabilities.audio)
  //   interfaces.push(...audio input...); // Voxtral
  // Add reasoning interface (the 'reasoning' capability flag appeared in 2026, superseding the magistral-only heuristic)
  if (capabilities?.reasoning || modelId.includes('magistral'))
    interfaces.push(LLM_IF_OAI_Reasoning);
  return interfaces;
}


export function mistralModels(wireModels: unknown): ModelDescriptionSchema[] {

  // 1. Parse and filter the API response
  const mistralModels = wireMistralModelsListSchema.parse(wireModels)
    .filter(m => !m.capabilities || m.capabilities.completion_chat) // removes: *-embed, *-moderation, *-ocr
    .filter(m => !m.id.includes('-ocr')); // explicit filter for OCR models


  // 2. Auto-hide models based on alias groups
  const aliasGroups = mistralModels.reduce((accGroups: Set<string>[], model) => {
    const modelIds = new Set([model.id, ...(model.aliases || [])]);

    // partition existing groups into those connected to the current model
    const connected = accGroups.filter(g => [...g].some(id => modelIds.has(id)));
    const unconnected = accGroups.filter(g => !connected.includes(g));

    // merge all connected groups with the current model's IDs into a single new group
    const mergedGroup = connected.reduce((merged, group) => {
      group.forEach(id => merged.add(id));
      return merged;
    }, modelIds);

    return [...unconnected, mergedGroup];
  }, []);

  // 2B. remove the latest entries from the groups
  const notSymlinks = aliasGroups.map(group => {
    const sortedIds = Array.from(group).sort();

    const yymmModels = sortedIds.filter(id => /-\d{4}$/.test(id));

    // pick the newest YYMM model if exists, otherwise pick the 2nd element otherwise the 1st
    return !yymmModels.length ? sortedIds[sortedIds.length > 1 ? 1 : 0]
      : yymmModels.sort((a, b) => parseInt(b.slice(-4), 10) - parseInt(a.slice(-4), 10))[0];
  }).filter(Boolean);


  // 3. Map the API models to our ModelDescriptionSchema
  const models = mistralModels.map((mistralModel): ModelDescriptionSchema => {
    const { id, created, capabilities, name, description, max_context_length } = mistralModel;

    const isSymlink = !notSymlinks.includes(id);
    const prettyName = _prettyMistralName(name);

    const extraDetails = _knownMistralModelDetails[id] || {};
    const labelOverride = extraDetails.label;

    return {
      id: id,
      label: labelOverride ?? (!isSymlink ? prettyName : `🔗 ${id} -> ${prettyName}`),
      created: created || 0,
      updated: /*updated ||*/ created || 0,
      description: description,
      contextWindow: max_context_length ?? null, // schema requires the field today; null (not a guess) if it ever loosens
      interfaces: _mistralCapabilitiesToInterfaces(capabilities, id),
      // parameterSpecs: ...
      // maxCompletionTokens: ...
      // benchmark, chatPrice, hidden: provided by extraDetails below:
      ...extraDetails,
      // Override hidden only if not explicitly set in extraDetails
      hidden: extraDetails.hidden ?? !notSymlinks.includes(id),
    };
  });

  // 4. Sort
  models.sort(_mistralModelsSort);

  // 5. Hide - pass 2 - hide earlier models versions
  for (let i = 1; i < models.length; i++) {
    const currentModel = models[i];
    const prevModel = models[i - 1];
    // if (prevModel.hidden) continue;

    if (currentModel.id.length > 4 && prevModel.id.length > 4 &&
      currentModel.id.slice(0, -4) === prevModel.id.slice(0, -4)) {
      currentModel.hidden = true;
    }
  }

  // 6. [DEV] check model definitions and pricing
  if (DEV_DEBUG_MISTRAL_MODELS) {

    // check stale model definitions (unknown check disabled - too many intentionally untracked models)
    const knownModelIds = Object.keys(_knownMistralModelDetails);
    llmDevCheckModels_DEV('Mistral', models.map(m => m.id), knownModelIds, { checkUnknown: false });

    // show missing pricing
    const missingPricing = knownModelIds.filter(id => !_knownMistralModelDetails[id].chatPrice);
    if (missingPricing.length > 0)
      console.log('[DEV] Mistral models missing pricing:', missingPricing);

  }

  return models;
}


/// Mistral Wire Parsers

type WireMistralModel = z.infer<typeof wireMistralModelSchema>;
const wireMistralModelSchema = z.object({

  id: z.string(),
  object: z.literal('model'),

  created: z.number(),  // it's the same number for all models...
  owned_by: z.string(), // not useful, always 'mistralai'
  type: z.string(), // 'base'

  capabilities: z.object({
    completion_chat: z.boolean(), // used to remove other models
    function_calling: z.boolean().nullish(),
    reasoning: z.boolean().nullish(),
    completion_fim: z.boolean().nullish(),
    fine_tuning: z.boolean().nullish(),
    vision: z.boolean().nullish(),
    ocr: z.boolean().nullish(),
    classification: z.boolean().nullish(),
    moderation: z.boolean().nullish(),
    audio: z.boolean().nullish(),
  }).nullish(),

  // UI description fields
  name: z.string(),
  description: z.string(),
  aliases: z.array(z.string()),

  // very useful
  max_context_length: z.number(),

  // misc, not used
  default_model_temperature: z.number().nullish(),
  // deprecation: z.any(),
  // deprecation_replacement_model: z.string().nullable(),
});

const wireMistralModelsListSchema = z.array(wireMistralModelSchema);
