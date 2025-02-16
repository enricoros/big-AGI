import type { GeminiWire_API_Models_List } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';

import type { ModelDescriptionSchema } from '../llm.server.types';

import { LLM_IF_GEM_CodeExecution, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';


// dev options
const DEV_DEBUG_GEMINI_MODELS = true;


// supported interfaces
const geminiChatInterfaces: GeminiWire_API_Models_List.Model['supportedGenerationMethods'] = ['generateContent'];

// unsupported interfaces
const filterUnallowedNames = ['Legacy'];
const filterUnallowedInterfaces: GeminiWire_API_Models_List.Model['supportedGenerationMethods'] = [
  'generateAnswer',   // e.g. removes "models/aqa"
  'embedContent',     // e.g. removes "models/embedding-001"
  'embedText',        // e.g. removes "models/text-embedding-004"
  'predict',          // e.g. removes "models/imagen-3.0-generate-002" (appeared on 2025-02-09)
];
const filterLyingModelNames: GeminiWire_API_Models_List.Model['name'][] = [
  // 2025-02-09 update: as of now they cleared the list, so we restart
  // 2024-12-10: name of models that are not what they say they are (e.g. 1114 is actually 1121 as of )
  'models/gemini-1.5-flash-8b-exp-0924',
  'models/gemini-1.5-flash-8b-exp-0827',
];


/* Manual models details
   Gemini Name Mapping example:
   - Latest version    gemini-1.0-pro-latest    <model>-<generation>-<variation>-latest
   - Latest stable     version  gemini-1.0-pro  <model>-<generation>-<variation>
   - Stable versions   gemini-1.0-pro-001       <model>-<generation>-<variation>-<version>

   Gemini capabilities chart (updated 2024-10-01):
   - [table stakes] System instructions
   - JSON Mode, with optional JSON Schema [NOTE: JSON Schema is poorly supported?]
   - Adjustable Safety Settings
   - Caching
   - Tuning
   - [good] Function calling, with configuration
   - [great] Code execution
*/

// Experimental Gemini models are Free of charge
const geminiExpPricingFree: ModelDescriptionSchema['chatPrice'] = {
  input: 'free', output: 'free',
};

const gemini20FlashPricing: ModelDescriptionSchema['chatPrice'] = {
  input: 0.10, // inputAudio: 0.70,
  output: 0.40,
};

const gemini20FlashLitePricing: ModelDescriptionSchema['chatPrice'] = {
  input: 0.075,
  output: 0.30,
};

const gemini15FlashPricing: ModelDescriptionSchema['chatPrice'] = {
  input: [{ upTo: 128000, price: 0.075 }, { upTo: null, price: 0.15 }],
  output: [{ upTo: 128000, price: 0.30 }, { upTo: null, price: 0.60 }],
};

const gemini15Flash8BPricing: ModelDescriptionSchema['chatPrice'] = {
  input: [{ upTo: 128000, price: 0.0375 }, { upTo: null, price: 0.075 }],
  output: [{ upTo: 128000, price: 0.15 }, { upTo: null, price: 0.30 }],
};

const gemini15ProPricing: ModelDescriptionSchema['chatPrice'] = {
  input: [{ upTo: 128000, price: 1.25 }, { upTo: null, price: 2.50 }],
  output: [{ upTo: 128000, price: 5.00 }, { upTo: null, price: 10.00 }],
};

const gemini10ProPricing: ModelDescriptionSchema['chatPrice'] = {
  input: 0.50,
  output: 1.50,
};

const _knownGeminiModels: ({
  id: string,
  labelOverride?: string,
  isNewest?: boolean,
  isPreview?: boolean,
  symLink?: string,
  description?: string,
  deprecated?: string, // Gemini may provide deprecation dates
  _delete?: boolean, // some gemini models are not acknowledged by Google Docs anymore, and leaving them in the list will confuse users
} & Pick<ModelDescriptionSchema, 'interfaces' | 'parameterSpecs' | 'chatPrice' | 'hidden' | 'benchmark'>)[] = [

  /// Generation 2.0

  // 2.0 Pro
  {
    id: 'models/gemini-2.0-pro-exp-02-05',
    isPreview: true,
    // isNewest: true,
    chatPrice: geminiExpPricingFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
    description: 'Improved quality, especially for world knowledge, code, and long context',
    benchmark: { cbaElo: 1379 },
  },
  {
    id: 'models/gemini-2.0-pro-exp',
    isPreview: true,
    chatPrice: geminiExpPricingFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
    description: 'Improved quality, especially for world knowledge, code, and long context',
    hidden: true, // only keeping the latest
  },
  {
    id: 'models/gemini-exp-1206',
    labelOverride: 'Gemini 2.0 Pro Experimental 1206',
    isPreview: true,
    chatPrice: geminiExpPricingFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
    hidden: true, // replaced by gemini-2.0-pro-exp-02-05
    // _delete: true,
  },

  // 2.0 Flash Thinking models
  {
    id: 'models/gemini-2.0-flash-thinking-exp', // alias to the latest Flash Thinking model
    labelOverride: 'Gemini 2.0 Flash Thinking Experimental',
    // symLink: 'models/gemini-2.0-flash-thinking-exp-01-21',
    chatPrice: geminiExpPricingFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_GEM_CodeExecution],
    parameterSpecs: [{ paramId: 'llmVndGeminiShowThoughts' }],
    benchmark: { cbaElo: 1384 },
    hidden: true, // only keeping the latest
  },
  {
    id: 'models/gemini-2.0-flash-thinking-exp-01-21',
    isPreview: true,
    chatPrice: geminiExpPricingFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_GEM_CodeExecution],
    parameterSpecs: [{ paramId: 'llmVndGeminiShowThoughts' }],
    benchmark: { cbaElo: 1384 },
  },
  {
    id: 'models/gemini-2.0-flash-thinking-exp-1219',
    labelOverride: 'Gemini 2.0 Flash Thinking Experimental 1219',
    isPreview: true,
    chatPrice: geminiExpPricingFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_GEM_CodeExecution],
    parameterSpecs: [{ paramId: 'llmVndGeminiShowThoughts' }],
    benchmark: { cbaElo: 1363 },
    // _delete: true, // replaced by `gemini-2.0-flash-thinking-exp-01-21`
    hidden: true, // only keeping the latest
  },

  // 2.0 Flash
  {
    id: 'models/gemini-2.0-flash-exp',
    isPreview: true,
    chatPrice: geminiExpPricingFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
    // _delete: true,
    hidden: true, // ambiguous
  },
  {
    id: 'models/gemini-2.0-flash',
    chatPrice: gemini20FlashPricing,
    symLink: 'models/gemini-2.0-flash-001',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1355 },
  },
  {
    id: 'models/gemini-2.0-flash-001',
    chatPrice: gemini20FlashPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1355 },
  },

  // 2.0 Flash Lite
  {
    id: 'models/gemini-2.0-flash-lite-preview-02-05',
    isPreview: true,
    chatPrice: gemini20FlashLitePricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision], // No function calling or code execution
    benchmark: { cbaElo: 1309 },
  },
  {
    id: 'models/gemini-2.0-flash-lite-preview',
    isPreview: true,
    chatPrice: gemini20FlashLitePricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision], // No function calling or code execution
    benchmark: { cbaElo: 1294 }, // Placeholder, outperforms 1.5 Flash
    hidden: true,
  },


  /// Generation 1.5

  // Gemini 1.5 Flash Models
  {
    id: 'models/gemini-1.5-flash-latest', // updated regularly and might be a preview version
    isPreview: true,
    chatPrice: gemini15FlashPricing,
    // symLink: '-002 or newer',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
  },
  {
    id: 'models/gemini-1.5-flash',
    // Defaults to version 002 on Oct 8, 2024
    symLink: 'models/gemini-1.5-flash-002',
    chatPrice: gemini15FlashPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1271 },
  },
  {
    id: 'models/gemini-1.5-flash-002', // new stable version
    chatPrice: gemini15FlashPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1271 },
    hidden: true,
  },
  {
    id: 'models/gemini-1.5-flash-001', // previous stable version
    chatPrice: gemini15FlashPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1227 },
    hidden: true,
  },
  {
    id: 'models/gemini-1.5-flash-001-tuning', // supports model tuning
    chatPrice: gemini15FlashPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution /* Tuning ... */],
    hidden: true,
  },

  // Gemini 1.5 Flash-8B Models
  {
    id: 'models/gemini-1.5-flash-8b-exp-0924',
    isPreview: true,
    chatPrice: geminiExpPricingFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json],
    hidden: true,
    _delete: true, // replaced by gemini-1.5-flash-8b
  },
  {
    id: 'models/gemini-1.5-flash-8b-exp-0827',
    isPreview: true,
    chatPrice: geminiExpPricingFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json],
    hidden: true,
    benchmark: { cbaElo: 1205 },
    _delete: true, // replaced by gemini-1.5-flash-8b
  },
  {
    id: 'models/gemini-1.5-flash-8b-latest',
    isPreview: false,
    chatPrice: gemini15Flash8BPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
  },
  {
    id: 'models/gemini-1.5-flash-8b',
    symLink: 'models/gemini-1.5-flash-8b-001',
    chatPrice: gemini15Flash8BPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
    // benchmark: { cbaElo: value if known },
  },
  {
    id: 'models/gemini-1.5-flash-8b-001',
    chatPrice: gemini15Flash8BPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
    // benchmark: { cbaElo: value if known },
    hidden: true,
  },

  // Gemini 1.5 Pro Models
  {
    id: 'models/gemini-1.5-pro-latest', // updated to latest stable version
    chatPrice: gemini15ProPricing,
    // symLink: '-002 or newer',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
  },
  {
    id: 'models/gemini-1.5-pro',
    symLink: 'models/gemini-1.5-pro-002',
    chatPrice: gemini15ProPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
  },
  {
    id: 'models/gemini-1.5-pro-002',
    chatPrice: gemini15ProPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
    hidden: true,
  },
  {
    id: 'models/gemini-1.5-pro-001',
    chatPrice: gemini15ProPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1260 },
    hidden: true,
  },


  // LearnLM Experimental Model
  {
    id: 'models/learnlm-1.5-pro-experimental',
    isPreview: true,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    description: 'LearnLM is an experimental task-specific model aligned with learning science principles.',
    // hidden: true,
    // _delete: true,
  },


  // Generation 1.0

  // Gemini 1.0 Pro Models (Deprecated)
  {
    id: 'models/gemini-1.0-pro-latest',
    // symLink: 'models/gemini-1.0-pro-001',
    chatPrice: gemini10ProPricing,
    interfaces: [LLM_IF_OAI_Chat],
    deprecated: '2025-02-15',
    // _delete: true, // kept for reference, but doc states deprecation on 2025-02-15
  },
  {
    id: 'models/gemini-1.0-pro-001',
    labelOverride: 'Gemini 1.0 Pro', // remove the 'Tuning'
    chatPrice: gemini10ProPricing,
    interfaces: [LLM_IF_OAI_Chat],
    benchmark: { cbaElo: 1132 },
    deprecated: '2025-02-15',
  },
  {
    id: 'models/gemini-1.0-pro',
    symLink: 'models/gemini-1.0-pro-001',
    chatPrice: gemini10ProPricing,
    interfaces: [LLM_IF_OAI_Chat],
    deprecated: '2025-02-15',
    hidden: true,
  },
  {
    id: 'models/gemini-pro',
    symLink: 'models/gemini-1.0-pro',
    chatPrice: gemini10ProPricing,
    interfaces: [LLM_IF_OAI_Chat],
    deprecated: '2025-02-15',
    _delete: true, // confusing old model name
  },


  // Gemini 1.0 Pro Vision Model
  {
    id: 'models/gemini-1.0-pro-vision-latest',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    hidden: true,
    _delete: true, // confusing
  },
  {
    id: 'models/gemini-pro-vision',
    symLink: 'models/gemini-1.0-pro-vision',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision], // Text and Images
    _delete: true, // confusing
  },
];


export function geminiFilterModels(geminiModel: GeminiWire_API_Models_List.Model): boolean {
  const isAllowed = !filterUnallowedNames.some(name => geminiModel.displayName.includes(name));
  const isSupported = !filterUnallowedInterfaces.some(iface => geminiModel.supportedGenerationMethods.includes(iface));
  const isWhatItSaysItIs = !filterLyingModelNames.includes(geminiModel.name);
  return isAllowed && isSupported && isWhatItSaysItIs;
}


const _sortOderIdPrefix: string[] = [
  'models/gemini-exp',
  'models/gemini-2.0-pro',
  'models/gemini-2.0-flash-thinking',
  'models/gemini-2.0-flash',
  'models/gemini-1.5-pro',
  'models/gemini-1.5-flash',
  'models/gemini-1.5-flash-8b',
  'models/gemini-1.0-pro',
  'models/gemini-pro',
] as const;

export function geminiSortModels(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // hidden to the bottom, then names descending
  // if (a.hidden && !b.hidden) return 1;
  // if (!a.hidden && b.hidden) return -1;
  // models beginning with 'gemini-' to the top
  const aGemini = a.label.startsWith('Gemini');
  const bGemini = b.label.startsWith('Gemini');
  if (aGemini && !bGemini) return -1;
  if (!aGemini && bGemini) return 1;
  // sort by sortOrderIdPrefix
  const aPrefix = _sortOderIdPrefix.find(p => a.id.startsWith(p));
  const bPrefix = _sortOderIdPrefix.find(p => b.id.startsWith(p));
  if (aPrefix && bPrefix) {
    if (aPrefix < bPrefix) return 1;
    if (aPrefix > bPrefix) return -1;
  }
  // sort by label descending
  return b.label.localeCompare(a.label);
}

export function geminiModelToModelDescription(geminiModel: GeminiWire_API_Models_List.Model): ModelDescriptionSchema | null {
  const { description, displayName, name: modelId, supportedGenerationMethods } = geminiModel;

  // if (DEV_DEBUG_GEMINI_MODELS)
  //   console.log('geminiModelToModelDescription', geminiModel);

  // find known manual mapping
  const knownModel = _knownGeminiModels.find(m => m.id === modelId);
  if (!knownModel && DEV_DEBUG_GEMINI_MODELS)
    console.warn('geminiModelToModelDescription: unknown model', modelId, geminiModel);

  // handle _delete
  if (knownModel?._delete)
    return null;

  // handle symlinks
  let label = knownModel?.symLink
    ? `🔗 ${knownModel?.labelOverride || displayName} → ${knownModel.symLink}`
    : knownModel?.labelOverride || displayName;

  // FIX: the Gemini 1114 model now returns 1121 as the version.. highlight the issue
  // if (geminiModel.name.endsWith('1114') && label.endsWith('1121'))
  //   label += ' (really: 1114)';

  // handle hidden models
  const hasChatInterfaces = supportedGenerationMethods.some(iface => geminiChatInterfaces.includes(iface));
  const hidden = knownModel?.hidden || !!knownModel?.symLink || !hasChatInterfaces;

  // context window
  const { inputTokenLimit, outputTokenLimit } = geminiModel;
  const contextWindow = inputTokenLimit + outputTokenLimit;

  // description
  const { version, topK, topP, temperature } = geminiModel;
  const descriptionLong = (knownModel?.description || description) + ` (Version: ${version}, Defaults: temperature=${temperature}, topP=${topP}, topK=${topK}, interfaces=[${supportedGenerationMethods.join(',')}])`;

  // use known interfaces, or add chat if this is a generateContent model
  const interfaces: ModelDescriptionSchema['interfaces'] = knownModel?.interfaces || [];
  if (!interfaces.length && hasChatInterfaces) {
    // newer models get good capabilities by default
    interfaces.push(LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Json);
  }

  return {
    id: modelId,
    label: label, // + (knownModel?.isNewest ? ' 🌟' : ''),
    // created: ...
    // updated: ...
    description: descriptionLong,
    contextWindow: contextWindow,
    maxCompletionTokens: outputTokenLimit,
    // trainingDataCutoff: knownModel?.trainingDataCutoff, // disabled as we don't get this from Gemini
    interfaces,
    parameterSpecs: knownModel?.parameterSpecs,
    // rateLimits: isGeminiPro ? { reqPerMinute: 60 } : undefined,
    benchmark: knownModel?.benchmark,
    chatPrice: knownModel?.chatPrice,
    hidden,
    // deprecated: knownModel?.deprecated,
  };
}
