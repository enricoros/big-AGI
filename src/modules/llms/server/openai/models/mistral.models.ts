import * as z from 'zod/v4';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import type { ModelDescriptionSchema } from '../../llm.server.types';


// configuration
const MISTRAL_DEV_SHOW_GAPS = Release.IsNodeDevBuild;


// [Mistral]
// Updated 2025-10-28
// - models on: https://docs.mistral.ai/getting-started/models/models_overview/
// - pricing on: https://mistral.ai/pricing#api-pricing
// - benchmark elo on CBA

const _knownMistralModelDetails: Record<string, {
  chatPrice?: { input: number; output: number };
  benchmark?: { cbaElo: number };
  hidden?: boolean;
}> = {

  // Premier models
  'mistral-medium-2508': { chatPrice: { input: 0.4, output: 2 } }, // mistral-medium-3 (Aug 2025)
  'mistral-medium-2505': { chatPrice: { input: 0.4, output: 2 }, benchmark: { cbaElo: 1383 }, hidden: true }, // older version
  'mistral-medium-latest': { chatPrice: { input: 0.4, output: 2 }, hidden: true }, // → 2508
  'mistral-medium': { chatPrice: { input: 0.4, output: 2 }, benchmark: { cbaElo: 1165 }, hidden: true }, // old symlink

  'magistral-medium-2509': { chatPrice: { input: 2, output: 5 } }, // v25.09
  'magistral-medium-2506': { chatPrice: { input: 2, output: 5 }, hidden: true }, // older version
  'magistral-medium-latest': { chatPrice: { input: 2, output: 5 }, hidden: true }, // symlink

  'devstral-medium-2507': { chatPrice: { input: 0.4, output: 2 } }, // v25.07

  'mistral-large-2411': { chatPrice: { input: 2, output: 6 }, benchmark: { cbaElo: 1305 } }, // mistral-large-2411
  'mistral-large-2407': { chatPrice: { input: 2, output: 6 }, benchmark: { cbaElo: 1314 }, hidden: true }, // older version
  'mistral-large-latest': { chatPrice: { input: 2, output: 6 }, benchmark: { cbaElo: 1305 }, hidden: true }, // symlink

  'pixtral-large-2411': { chatPrice: { input: 2, output: 6 } },
  'pixtral-large-latest': { chatPrice: { input: 2, output: 6 }, hidden: true }, // symlink

  'codestral-2508': { chatPrice: { input: 0.3, output: 0.9 } }, // v25.08
  'codestral-2501': { chatPrice: { input: 0.3, output: 0.9 }, hidden: true }, // older version
  'codestral-latest': { chatPrice: { input: 0.3, output: 0.9 }, hidden: true }, // symlink

  'voxtral-small-2507': { chatPrice: { input: 0.1, output: 0.3 } }, // v25.07 (text tokens)
  'voxtral-small-latest': { chatPrice: { input: 0.1, output: 0.3 }, hidden: true }, // symlink

  'voxtral-mini-2507': { chatPrice: { input: 0.04, output: 0.04 } }, // v25.07 (text tokens)
  'voxtral-mini-latest': { chatPrice: { input: 0.04, output: 0.04 }, hidden: true }, // symlink

  'ministral-8b-2410': { chatPrice: { input: 0.1, output: 0.1 }, benchmark: { cbaElo: 1240 } }, // ministral-8b-2410
  'ministral-8b-latest': { chatPrice: { input: 0.1, output: 0.1 }, benchmark: { cbaElo: 1240 }, hidden: true }, // symlink

  // Note: mistral-saba, ministral-3b, embed, and moderation models are filtered out (not chat models or not available via API)

  // Open models
  'mistral-small-2506': { chatPrice: { input: 0.1, output: 0.3 } },
  'mistral-small-2503': { chatPrice: { input: 0.1, output: 0.3 }, benchmark: { cbaElo: 1298 }, hidden: true }, // older version
  'mistral-small-2501': { chatPrice: { input: 0.1, output: 0.3 }, benchmark: { cbaElo: 1235 }, hidden: true }, // older version
  'mistral-small-2409': { chatPrice: { input: 0.1, output: 0.3 }, hidden: true }, // older version
  'mistral-small-latest': { chatPrice: { input: 0.1, output: 0.3 }, hidden: true }, // symlink
  'mistral-small': { chatPrice: { input: 0.1, output: 0.3 }, hidden: true }, // symlink

  'magistral-small-2509': { chatPrice: { input: 0.5, output: 1.5 } }, // v25.09
  'magistral-small-2506': { chatPrice: { input: 0.5, output: 1.5 }, hidden: true }, // older version
  'magistral-small-latest': { chatPrice: { input: 0.5, output: 1.5 }, hidden: true }, // symlink

  'devstral-small-2507': { chatPrice: { input: 0.1, output: 0.3 } }, // v25.07
  'devstral-small-2505': { chatPrice: { input: 0.1, output: 0.3 }, hidden: true }, // older version
  'devstral-small-latest': { chatPrice: { input: 0.1, output: 0.3 }, hidden: true }, // symlink

  'pixtral-12b-2409': { chatPrice: { input: 0.15, output: 0.15 } },
  'pixtral-12b-latest': { chatPrice: { input: 0.15, output: 0.15 }, hidden: true }, // symlink
  'pixtral-12b': { chatPrice: { input: 0.15, output: 0.15 }, hidden: true }, // symlink

  'open-mistral-nemo-2407': { chatPrice: { input: 0.15, output: 0.15 } },
  'open-mistral-nemo': { chatPrice: { input: 0.15, output: 0.15 }, hidden: true }, // symlink

  // Legacy models
  'open-mixtral-8x22b-2404': { chatPrice: { input: 2, output: 6 }, benchmark: { cbaElo: 1165 }, hidden: true }, // legacy
  'open-mixtral-8x22b': { chatPrice: { input: 2, output: 6 }, benchmark: { cbaElo: 1165 }, hidden: true }, // legacy symlink
  'open-mixtral-8x7b': { chatPrice: { input: 0.7, output: 0.7 }, benchmark: { cbaElo: 1131 }, hidden: true }, // legacy
  'open-mistral-7b': { chatPrice: { input: 0.25, output: 0.25 }, hidden: true }, // legacy
};


const mistralModelFamilyOrder = [
  // Premier
  'magistral-medium',
  'mistral-medium',
  'devstral-medium',
  'mistral-large',
  'pixtral-large',
  'codestral',
  'magistral-small',
  'mistral-small',
  'devstral-small',
  'voxtral-small',
  'voxtral-mini',
  'mistral-embed',
  'mistral-ocr',
  'ministral-8b',
  'ministral-3b',
  'codestral-embed',
  'mistral-moderation',
  // Open
  'open-codestral-mamba',
  'pixtral-12b',
  'open-mistral-nemo',
  // Legacy
  'open-mixtral-8x22b',
  'open-mixtral-8x7b',
  'mistral-small-2312', // note: this is set here explicitly, because otherwise it would show up earlier in the list due to its real name being the open mixtral 8x7b
  'open-mistral-7b',
  // Open
  'mistral-saba',
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
  // Add reasoning interface for magistral models
  if (modelId.includes('magistral'))
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

    return {
      id: id,
      label: !isSymlink ? prettyName : `🔗 ${id} → ${prettyName}`,
      created: created || 0,
      updated: /*updated ||*/ created || 0,
      description: description,
      contextWindow: max_context_length ?? 32768,
      interfaces: _mistralCapabilitiesToInterfaces(capabilities, id),
      // parameterSpecs: ...
      // maxCompletionTokens: ...
      // trainingDataCutoff: ...
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

  // 6. [DEV] find items in _knownMistralModelDetails that are not in the models list
  if (MISTRAL_DEV_SHOW_GAPS) {

    // show missing pricing
    const knownModelIds = Object.keys(_knownMistralModelDetails);
    const missingPricing = knownModelIds.filter(id => !_knownMistralModelDetails[id].chatPrice);
    if (missingPricing.length > 0)
      console.warn('[DEV] Mistral models missing pricing:', missingPricing);

    // show extra pricing
    const missingModels = knownModelIds.filter(id => !models.some(m => m.id === id));
    if (missingModels.length > 0)
      console.log('[DEV] Mistral models not in the list:', missingModels);
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
    completion_fim: z.boolean().nullish(),
    function_calling: z.boolean().nullish(),
    fine_tuning: z.boolean().nullish(),
    vision: z.boolean().nullish(),
    classification: z.boolean().nullish(),
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
