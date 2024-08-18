import type { GeminiWire_API_Models_List } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';

import type { ModelDescriptionSchema } from '../llm.server.types';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';


// dev options
const DEV_DEBUG_GEMINI_MODELS = false;


// supported interfaces
const geminiChatInterfaces: GeminiWire_API_Models_List.Model['supportedGenerationMethods'] = ['generateContent'];

// unsupported interfaces
const filterUnallowedNames = ['Legacy'];
const filterUnallowedInterfaces: GeminiWire_API_Models_List.Model['supportedGenerationMethods'] = ['generateAnswer', 'embedContent', 'embedText'];


/* Manual models details
   Gemini Name Mapping example:
   - Latest version    gemini-1.0-pro-latest    <model>-<generation>-<variation>-latest
   - Latest stable     version  gemini-1.0-pro  <model>-<generation>-<variation>
   - Stable versions   gemini-1.0-pro-001       <model>-<generation>-<variation>-<version>

   Gemini capabilities chart (updated 2024-08-03):
   - [table stakes] System instructions
   - JSON Mode, with optional JSON Schema [NOTE: JSON Schema is poorly supported?]
   - Adjustable Safety Settings
   - Caching
   - Tuning
   - [good] Function calling, with configuration
   - [great] Code execution
*/

const gemini15FlashPricing: ModelDescriptionSchema['chatPrice'] = {
  input: [{ upTo: 128000, price: 0.075 }, { upTo: null, price: 0.15 }],
  output: [{ upTo: 128000, price: 0.30 }, { upTo: null, price: 0.60 }],
};

const gemini15ProPricing: ModelDescriptionSchema['chatPrice'] = {
  input: [{ upTo: 128000, price: 3.50 }, { upTo: null, price: 7.00 }],
  output: [{ upTo: 128000, price: 10.50 }, { upTo: null, price: 21.00 }],
};

const gemini10ProPricing: ModelDescriptionSchema['chatPrice'] = {
  input: 0.50,
  output: 1.50,
};

const _knownGeminiModels: ({
  id: string,
  isNewest?: boolean,
  isPreview?: boolean
  symLink?: string
} & Pick<ModelDescriptionSchema, 'interfaces' | 'chatPrice' | 'trainingDataCutoff' | 'hidden'>)[] = [

  // Generation 1.5
  {
    id: 'models/gemini-1.5-flash-latest', // updated regularly and might be a preview version
    isNewest: true,
    isPreview: true,
    chatPrice: gemini15FlashPricing,
    trainingDataCutoff: 'May 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json /*, Code Execution */], // input: audio, images and text
  },
  {
    id: 'models/gemini-1.5-flash',
    // copied from above
    chatPrice: gemini15FlashPricing,
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json], // input: audio, images and text
    hidden: true,
  },
  {
    id: 'models/gemini-1.5-flash-001',
    // copied from above
    chatPrice: gemini15FlashPricing,
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json], // input: audio, images and text
    hidden: true,
  },

  {
    id: 'models/gemini-1.5-pro-exp-0801',
    isNewest: true,
    isPreview: true,
    chatPrice: gemini15ProPricing,
    trainingDataCutoff: 'May 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json /*, Code Execution */], // input: audio, images and text
  },
  {
    id: 'models/gemini-1.5-pro-latest', // updated regularly and might be a preview version
    isNewest: true,
    isPreview: true,
    chatPrice: gemini15ProPricing,
    trainingDataCutoff: 'May 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json /*, Code Execution */], // input: audio, images and text
  },
  {
    id: 'models/gemini-1.5-pro', // latest stable -> 001
    // copied from above
    chatPrice: gemini15ProPricing,
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json],
    hidden: true,
  },
  {
    id: 'models/gemini-1.5-pro-001', // stable snapshot
    // copied from above
    chatPrice: gemini15ProPricing,
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json],
    hidden: true,
  },


  // Generation 1.0
  {
    id: 'models/gemini-1.0-pro-latest',
    chatPrice: gemini10ProPricing,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    id: 'models/gemini-1.0-pro',
    chatPrice: gemini10ProPricing,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
  {
    id: 'models/gemini-1.0-pro-001',
    chatPrice: gemini10ProPricing,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },

  // Generation 1.0 + Vision
  {
    id: 'models/gemini-1.0-pro-vision-latest',
    chatPrice: gemini10ProPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision], // Text and Images
    hidden: true,
  },

  // Older symlinks
  {
    id: 'models/gemini-pro',
    symLink: 'models/gemini-1.0-pro',
    // copied from symlinked
    chatPrice: gemini10ProPricing,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
  {
    id: 'models/gemini-pro-vision',
    // copied from symlinked
    symLink: 'models/gemini-1.0-pro-vision',
    chatPrice: gemini10ProPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision], // Text and Images
    hidden: true,
  },
];


export function geminiFilterModels(geminiModel: GeminiWire_API_Models_List.Model): boolean {
  const isAllowed = !filterUnallowedNames.some(name => geminiModel.displayName.includes(name));
  const isSupported = !filterUnallowedInterfaces.some(iface => geminiModel.supportedGenerationMethods.includes(iface));
  return isAllowed && isSupported;
}

export function geminiSortModels(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // hidden to the bottom, then names descending
  if (a.hidden && !b.hidden) return 1;
  if (!a.hidden && b.hidden) return -1;
  return b.label.localeCompare(a.label);
}

export function geminiModelToModelDescription(geminiModel: GeminiWire_API_Models_List.Model): ModelDescriptionSchema {
  const { description, displayName, name: modelId, supportedGenerationMethods } = geminiModel;

  if (DEV_DEBUG_GEMINI_MODELS)
    console.log('geminiModelToModelDescription', geminiModel);

  // find known manual mapping
  const knownModel = _knownGeminiModels.find(m => m.id === modelId);

  // handle symlinks
  const label = knownModel?.symLink
    ? `🔗 ${displayName.replace('1.0', '')} → ${knownModel.symLink}`
    : displayName;

  // handle hidden models
  const hasChatInterfaces = supportedGenerationMethods.some(iface => geminiChatInterfaces.includes(iface));
  const hidden = knownModel?.hidden || !!knownModel?.symLink || !hasChatInterfaces;

  // context window
  const { inputTokenLimit, outputTokenLimit } = geminiModel;
  const contextWindow = inputTokenLimit + outputTokenLimit;

  // description
  const { version, topK, topP, temperature } = geminiModel;
  const descriptionLong = description + ` (Version: ${version}, Defaults: temperature=${temperature}, topP=${topP}, topK=${topK}, interfaces=[${supportedGenerationMethods.join(',')}])`;

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
    trainingDataCutoff: knownModel?.trainingDataCutoff,
    interfaces,
    // rateLimits: isGeminiPro ? { reqPerMinute: 60 } : undefined,
    // benchmarks: ...
    chatPrice: knownModel?.chatPrice,
    hidden,
  };
}
