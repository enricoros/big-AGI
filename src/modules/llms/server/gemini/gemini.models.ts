import type { GeminiWire_API_Models_List } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';

import type { ModelDescriptionSchema } from '../llm.server.types';

import { LLM_IF_GEM_CodeExecution, LLM_IF_HOTFIX_NoStream, LLM_IF_HOTFIX_StripImages, LLM_IF_HOTFIX_StripSys0, LLM_IF_HOTFIX_Sys0ToUsr0, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_Outputs_Audio, LLM_IF_Outputs_Image, LLM_IF_Outputs_NoText } from '~/common/stores/llms/llms.types';


// dev options
const DEV_DEBUG_GEMINI_MODELS = true;


// supported interfaces
const geminiChatInterfaces: GeminiWire_API_Models_List.Model['supportedGenerationMethods'] = ['generateContent'];

// unsupported interfaces
const filterUnallowedNames = ['Legacy'];
// const filterUnallowedInterfaces: GeminiWire_API_Models_List.Model['supportedGenerationMethods'] = [
//   'generateAnswer',     // e.g. removes "models/aqa"
//   'embedContent',       // e.g. removes "models/embedding-001"
//   'embedText',          // e.g. removes "models/text-embedding-004"
//   'predict',            // e.g. removes "models/imagen-3.0-generate-002" (appeared on 2025-02-09)
//   'predictLongRunning', // e.g. removes "models/veo-2.0-generate-001" (appeared on 2025-04-10)
// ];
const filterLyingModelNames: GeminiWire_API_Models_List.Model['name'][] = [
  // 2025-02-27: verified, old model is no more
  'models/gemini-2.0-flash-exp', // verified, replaced by gemini-2.0-flash, which is non-free anymore

  // 2025-02-09 update: as of now they cleared the list, so we restart
  // 2024-12-10: name of models that are not what they say they are (e.g. 1114 is actually 1121 as of )
  'models/gemini-1.5-flash-8b-exp-0924', // replaced by non-free
  'models/gemini-1.5-flash-8b-exp-0827', // replaced by non-free
];


/* Manual models details
   Gemini Name Mapping example:
   - Latest version    gemini-1.0-pro-latest    <model>-<generation>-<variation>-latest
   - Latest stable     version  gemini-1.0-pro  <model>-<generation>-<variation>
   - Stable versions   gemini-1.0-pro-001       <model>-<generation>-<variation>-<version>

   Gemini capabilities chart (updated 2025-05-27):
   - [table stakes] System instructions
   - JSON Mode, with optional JSON Schema
   - Adjustable Safety Settings
   - Caching
   - Tuning
   - Function calling, with configuration
   - Code execution
   - Thinking / Reasoning with thinking budget
   - Audio generation
   - Live API
   - Native Audio (dialog models)
   - Text-to-Speech models
*/

// Experimental Gemini models are Free of charge
const geminiExpFree: ModelDescriptionSchema['chatPrice'] = {
  input: 'free', output: 'free',
};


// Pricing based on https://ai.google.dev/pricing (May 27, 2025)

const gemini25ProPreviewPricing: ModelDescriptionSchema['chatPrice'] = {
  input: [{ upTo: 200000, price: 1.25 }, { upTo: null, price: 2.50 }],
  output: [{ upTo: 200000, price: 10.00 }, { upTo: null, price: 15.00 }],
};

const gemini25FlashPreviewNonThinkingPricing: ModelDescriptionSchema['chatPrice'] = {
  input: 0.15, // text/image/video; audio is $1.00 but we don't differentiate yet
  output: 0.60, // non-thinking
};

const gemini25FlashPreviewThinkingPricing: ModelDescriptionSchema['chatPrice'] = {
  input: 0.15, // text/image/video; audio is $1.00 but we don't differentiate yet
  output: 3.50, // thinking
};

const gemini25FlashNativeAudioPricing: ModelDescriptionSchema['chatPrice'] = {
  input: 0.50, // text; audio/video is $3.00 but we don't differentiate yet
  output: 2.00, // text; audio is $12.00 but we don't differentiate yet
};

const gemini25FlashPreviewTTSPricing: ModelDescriptionSchema['chatPrice'] = {
  input: 0.50, // text input
  // output: 10.00, // not ready for audio output yet, as of 2025-05-27
};

const gemini25ProPreviewTTSPricing: ModelDescriptionSchema['chatPrice'] = {
  input: 1.00, // text input
  // output: 20.00, // not ready for audio output yet, as of 2025-05-27
};

const gemini20FlashPricing: ModelDescriptionSchema['chatPrice'] = {
  input: 0.10, // text/image/video; audio is $0.70 but we don't differentiate yet
  output: 0.40,
  // Caching pricing available
  // Image generation pricing: 0.039 - Image output is priced at $30 per 1,000,000 tokens. Output images up to 1024x1024px consume 1290 tokens and are equivalent to $0.039 per image.
};

const gemini20FlashLivePricing: ModelDescriptionSchema['chatPrice'] = {
  input: 0.35, // text; audio/video is $2.10 but we don't differentiate yet
  output: 1.50, // text; audio is $8.50 but we don't differentiate yet
};

const gemini20FlashLitePricing: ModelDescriptionSchema['chatPrice'] = {
  input: 0.075,
  output: 0.30,
  // Caching pricing available
};

const gemini15FlashPricing: ModelDescriptionSchema['chatPrice'] = {
  input: [{ upTo: 128000, price: 0.075 }, { upTo: null, price: 0.15 }],
  output: [{ upTo: 128000, price: 0.30 }, { upTo: null, price: 0.60 }],
  // Caching available
};

const gemini15Flash8BPricing: ModelDescriptionSchema['chatPrice'] = {
  input: [{ upTo: 128000, price: 0.0375 }, { upTo: null, price: 0.075 }],
  output: [{ upTo: 128000, price: 0.15 }, { upTo: null, price: 0.30 }],
  // Caching available
};

const gemini15ProPricing: ModelDescriptionSchema['chatPrice'] = {
  input: [{ upTo: 128000, price: 1.25 }, { upTo: null, price: 2.50 }],
  output: [{ upTo: 128000, price: 5.00 }, { upTo: null, price: 10.00 }],
  // Caching available
};


const _knownGeminiModels: ({
  id: string,
  labelOverride?: string,
  isPreview?: boolean,
  symLink?: string,
  deprecated?: string, // Gemini may provide deprecation dates
  _delete?: boolean, // some gemini models are not acknowledged by Google Docs anymore, and leaving them in the list will confuse users
} & Pick<ModelDescriptionSchema, 'interfaces' | 'parameterSpecs' | 'chatPrice' | 'hidden' | 'benchmark'>)[] = [

  /// Generation 2.5

  // 2.5 Pro Preview 05-06 version
  {
    id: 'models/gemini-2.5-pro-preview-05-06',
    isPreview: true,
    chatPrice: gemini25ProPreviewPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1446 },
  },
  // 2.5 Pro Preview 03-25 version
  {
    id: 'models/gemini-2.5-pro-preview-03-25',
    isPreview: true,
    // symLink: 'models/gemini-2.5-pro-preview-05-06', // Points to the newer version
    chatPrice: gemini25ProPreviewPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_GEM_CodeExecution],
    // parameterSpecs: [{ paramId: 'llmVndGeminiShowThoughts' }], // Gemini doesn't show thoughts anymore
    benchmark: { cbaElo: 1439 },
    hidden: true, // hard-superseded, but keeping this as non-symlink in case Gemini restores it
  },
  // 2.5 Pro Experimental (Free Tier)
  {
    id: 'models/gemini-2.5-pro-exp-03-25',
    isPreview: true,
    chatPrice: geminiExpFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_GEM_CodeExecution],
    // parameterSpecs: [{ paramId: 'llmVndGeminiShowThoughts' }], // Gemini doesn't show thoughts anymore
    benchmark: { cbaElo: 1437 /* +1 because free */ },
    hidden: true, // seems to be discouraged - still available, but cannot rely on it
  },

  // 2.5 Pro Preview TTS
  {
    id: 'models/gemini-2.5-pro-preview-tts',
    isPreview: true,
    chatPrice: gemini25ProPreviewTTSPricing,
    interfaces: [
      LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json,
      LLM_IF_Outputs_Audio, LLM_IF_Outputs_NoText,
      LLM_IF_HOTFIX_StripSys0, // TTS: no system instruction
      LLM_IF_HOTFIX_NoStream, // TTS: no streaming - use generateContent instead
    ],
    benchmark: undefined, // TTS models are not benchmarkable
    hidden: true, // audio outputs are unavailable as of 2025-05-27
  },

  // 2.5 Flash Preview
  {
    id: 'models/gemini-2.5-flash-preview-05-20',
    isPreview: true,
    chatPrice: gemini25FlashPreviewThinkingPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_GEM_CodeExecution],
    parameterSpecs: [{ paramId: 'llmVndGeminiThinkingBudget' }],
    benchmark: { cbaElo: 1424 },
  },
  {
    id: 'models/gemini-2.5-flash-preview-04-17',
    isPreview: true,
    chatPrice: gemini25FlashPreviewThinkingPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_GEM_CodeExecution],
    parameterSpecs: [{ paramId: 'llmVndGeminiThinkingBudget' }],
    benchmark: { cbaElo: 1392 },
    hidden: true, // Hidden now that 05-20 is available
  },
  {
    id: 'models/gemini-2.5-flash-preview-04-17-thinking',
    labelOverride: 'Gemini 2.5 Flash Preview (Cursor, 04-17)',
    isPreview: true,
    chatPrice: gemini25FlashPreviewThinkingPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_GEM_CodeExecution],
    parameterSpecs: [{ paramId: 'llmVndGeminiThinkingBudget' }],
    hidden: true,
  },

  // 2.5 Flash Preview TTS
  {
    id: 'models/gemini-2.5-flash-preview-tts',
    isPreview: true,
    chatPrice: gemini25FlashPreviewTTSPricing,
    interfaces: [
      LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json,
      LLM_IF_Outputs_Audio, LLM_IF_Outputs_NoText,
      LLM_IF_HOTFIX_StripSys0, // TTS: no system instruction
      LLM_IF_HOTFIX_NoStream, // TTS: no streaming - use generateContent instead
    ],
    benchmark: undefined, // TTS models are not benchmarkable
    hidden: true, // audio outputs are unavailable as of 2025-05-27
  },

  // 2.5 Flash Native Audio (Dialog and Thinking variants)
  {
    id: 'models/gemini-2.5-flash-preview-native-audio-dialog',
    isPreview: true,
    chatPrice: gemini25FlashNativeAudioPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_Outputs_Audio],
    benchmark: undefined, // Native audio models are not benchmarkable
    _delete: true, // dialog models unsupported as of 2025-05-27, but keeping the model for now
  },
  {
    id: 'models/gemini-2.5-flash-exp-native-audio-thinking-dialog',
    isPreview: true,
    chatPrice: gemini25FlashNativeAudioPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_Outputs_Audio],
    benchmark: undefined, // Native audio models are not benchmarkable
    _delete: true, // dialog models unsupported as of 2025-05-27, but keeping the model for now
  },


  /// Generation 2.0

  // 2.0 Pro Experimental (Superseded by 2.5 Pro Preview/Exp)
  {
    hidden: true, // superseded by 'models/gemini-2.5-pro-preview-03-25', but not fully removed yet
    id: 'models/gemini-2.0-pro-exp-02-05', // Base model: Gemini 2.0 Pro
    isPreview: true,
    chatPrice: geminiExpFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1380 },
  },
  {
    hidden: true, // only keeping the latest
    id: 'models/gemini-2.0-pro-exp',
    symLink: 'models/gemini-2.0-pro-exp-02-05',
    // copied from symlink
    isPreview: true,
    chatPrice: geminiExpFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1380 },
  },
  {
    _delete: true, // replaced by gemini-2.0-pro-exp-02-05, 2025-02-27: verified, old model is no more
    id: 'models/gemini-exp-1206',
    labelOverride: 'Gemini 2.0 Pro Experimental 1206',
    isPreview: true,
    chatPrice: geminiExpFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1374 },
  },

  // 2.0 Flash Live
  {
    id: 'models/gemini-2.0-flash-live-001',
    labelOverride: 'Gemini 2.0 Flash Live',
    chatPrice: gemini20FlashLivePricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_Outputs_Audio, LLM_IF_GEM_CodeExecution],
    isPreview: true,
    // benchmark: not available because of the Live API (non benchmarkable)
  },

  // 2.0 Flash Thinking Experimental (superseded by 2.5 Flash Preview, but we still show it because it's free)
  {
    id: 'models/gemini-2.0-flash-thinking-exp-01-21',
    labelOverride: 'Gemini 2.0 Flash Thinking Experimental 01-21',
    chatPrice: geminiExpFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning, LLM_IF_GEM_CodeExecution],
    // parameterSpecs: [{ paramId: 'llmVndGeminiShowThoughts' }], // Gemini doesn't show thoughts anymore
    benchmark: { cbaElo: 1380 },
    isPreview: true,
    hidden: true, // superseded by Gemini 2.5 Flash Preview
  },
  {
    hidden: true, // show the symlinked instead
    id: 'models/gemini-2.0-flash-thinking-exp',
    labelOverride: 'Gemini 2.0 Flash Thinking Experimental',
    symLink: 'models/gemini-2.0-flash-thinking-exp-01-21',
    // copied from symlink
    chatPrice: geminiExpFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning, LLM_IF_GEM_CodeExecution],
    // parameterSpecs: [{ paramId: 'llmVndGeminiShowThoughts' }], // Gemini doesn't show thoughts anymore
    benchmark: { cbaElo: 1380 },
    isPreview: true,
  },
  {
    hidden: true, // replaced by gemini-2.0-flash-thinking-exp-01-21 - 2025-02-27: seems still different on the API, hence no deletion yet
    id: 'models/gemini-2.0-flash-thinking-exp-1219',
    labelOverride: 'Gemini 2.0 Flash Thinking Experimental 12-19',
    chatPrice: geminiExpFree,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning, LLM_IF_GEM_CodeExecution],
    // parameterSpecs: [{ paramId: 'llmVndGeminiShowThoughts' }], // Gemini doesn't show thoughts anymore
    benchmark: { cbaElo: 1363 },
    isPreview: true,
  },

  // 2.0 Flash Preview Image Generation (Newer than the Experimental, introduced on 05-07)
  {
    id: 'models/gemini-2.0-flash-preview-image-generation',
    // labelOverride: 'Gemini 2.0 Flash Image Generation Preview',
    isPreview: true,
    chatPrice: gemini20FlashPricing, // FIXME: this is missing the per-image generation pricing! (We don't have it in the code yet)
    interfaces: [
      LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_GEM_CodeExecution,
      LLM_IF_Outputs_Image,
      LLM_IF_HOTFIX_StripSys0, // This first Gemini Image Generation model does not support the developer instruction
    ],
    // non benchmarkable because generates images
  },

  // 2.0 Flash Experimental Image Generation
  {
    id: 'models/gemini-2.0-flash-exp-image-generation',
    // labelOverride: 'Gemini 2.0 Flash Image Generation Experimental',
    chatPrice: geminiExpFree,
    interfaces: [
      LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_GEM_CodeExecution,
      LLM_IF_Outputs_Image,
      LLM_IF_HOTFIX_StripSys0, // This first Gemini Image Generation model does not support the developer instruction
    ],
    parameterSpecs: [],
    // non benchmarkable because generates images
    isPreview: true,
  },

  // 2.0 Flash
  {
    id: 'models/gemini-2.0-flash-001',
    chatPrice: gemini20FlashPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1355 },
  },
  {
    id: 'models/gemini-2.0-flash',
    symLink: 'models/gemini-2.0-flash-001',
    // copied from symlink
    chatPrice: gemini20FlashPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1354 },
  },

  // 2.0 Flash Lite
  {
    id: 'models/gemini-2.0-flash-lite',
    chatPrice: gemini20FlashLitePricing,
    symLink: 'models/gemini-2.0-flash-lite-001',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn],
    benchmark: { cbaElo: 1310 },
  },
  {
    id: 'models/gemini-2.0-flash-lite-001',
    chatPrice: gemini20FlashLitePricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn],
    benchmark: { cbaElo: 1310 },
  },
  {
    hidden: true, // discouraged, as the official is out
    id: 'models/gemini-2.0-flash-lite-preview-02-05',
    isPreview: true,
    chatPrice: gemini20FlashLitePricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn],
    benchmark: { cbaElo: 1312 },
  },
  {
    id: 'models/gemini-2.0-flash-lite-preview',
    symLink: 'models/gemini-2.0-flash-lite-preview-02-05',
    // coped from symlink
    isPreview: true,
    chatPrice: gemini20FlashLitePricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn],
    benchmark: { cbaElo: 1311 },
  },


  /// Generation 1.5

  // Gemini 1.5 Flash Models
  {
    id: 'models/gemini-1.5-flash-latest', // updated regularly and might be a preview version
    isPreview: true,
    chatPrice: gemini15FlashPricing,
    // symLink: '-002 or newer',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
  },
  {
    id: 'models/gemini-1.5-flash',
    // Defaults to version 002 on Oct 8, 2024
    symLink: 'models/gemini-1.5-flash-002',
    chatPrice: gemini15FlashPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1271 },
  },
  {
    id: 'models/gemini-1.5-flash-002', // new stable version
    chatPrice: gemini15FlashPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1271 },
    hidden: true,
  },
  {
    id: 'models/gemini-1.5-flash-001', // previous stable version
    chatPrice: gemini15FlashPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1227 },
    hidden: true,
  },
  {
    _delete: true, // Tuning seems supported by base model now
    id: 'models/gemini-1.5-flash-001-tuning', // supports model tuning
    chatPrice: gemini15FlashPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution /* Tuning ... */],
    hidden: true,
  },

  // Gemini 1.5 Flash-8B Models
  {
    id: 'models/gemini-1.5-flash-8b-latest',
    isPreview: false,
    chatPrice: gemini15Flash8BPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1212 },
  },
  {
    id: 'models/gemini-1.5-flash-8b',
    symLink: 'models/gemini-1.5-flash-8b-001',
    chatPrice: gemini15Flash8BPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1212 },
  },
  {
    id: 'models/gemini-1.5-flash-8b-001',
    chatPrice: gemini15Flash8BPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1212 },
    hidden: true,
  },

  // Gemini 1.5 Pro Models
  {
    id: 'models/gemini-1.5-pro-latest', // updated to latest stable version
    chatPrice: gemini15ProPricing,
    // symLink: '-002 or newer',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
  },
  {
    id: 'models/gemini-1.5-pro',
    symLink: 'models/gemini-1.5-pro-002',
    chatPrice: gemini15ProPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1302 },
  },
  {
    id: 'models/gemini-1.5-pro-002',
    chatPrice: gemini15ProPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1302 },
    hidden: true,
  },
  {
    id: 'models/gemini-1.5-pro-001',
    chatPrice: gemini15ProPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_GEM_CodeExecution],
    benchmark: { cbaElo: 1260 },
    hidden: true,
  },


  /// Generation 1.0

  // Gemini 1.0 Pro Vision Model
  {
    id: 'models/gemini-1.0-pro-vision-latest',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    hidden: true,
    _delete: true, // confusing and deprecated
  },
  {
    id: 'models/gemini-pro-vision',
    symLink: 'models/gemini-1.0-pro-vision',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision], // Text and Images
    _delete: true, // confusing and deprecated
  },


  /// Other Experimental Models

  // Gemma 3n Model (newer than 3, first seen on the May 2025 update)
  {
    id: 'models/gemma-3n-e4b-it',
    isPreview: true,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_HOTFIX_StripImages, LLM_IF_HOTFIX_Sys0ToUsr0],
    chatPrice: geminiExpFree, // Free tier only according to pricing page
    benchmark: { cbaElo: 1275 }, // Estimating based on comparable models
  },
  // Gemma 3 Experimental Models - note: we apply workarounds:
  // - LLM_IF_HOTFIX_StripImages, because: "Image input modality is not enabled for models/gemma-3-27b-it"
  // - LLM_IF_HOTFIX_Sys0ToUsr0, because: "Developer instruction is not enabled for models/gemma-3-27b-it"
  {
    id: 'models/gemma-3-27b-it',
    isPreview: true,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_HOTFIX_StripImages, LLM_IF_HOTFIX_Sys0ToUsr0],
    chatPrice: geminiExpFree, // Pricing page indicates free tier only
    benchmark: { cbaElo: 1341 },
    // hidden: true, // Keep visible if it's a distinct offering
  },
  {
    hidden: true, // keep larger model
    id: 'models/gemma-3-12b-it',
    isPreview: true,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_HOTFIX_StripImages, LLM_IF_HOTFIX_Sys0ToUsr0],
    chatPrice: geminiExpFree,
    benchmark: { cbaElo: 1321 },
  },
  {
    hidden: true, // keep larger model
    id: 'models/gemma-3-4b-it',
    isPreview: true,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_HOTFIX_StripImages, LLM_IF_HOTFIX_Sys0ToUsr0],
    chatPrice: geminiExpFree,
    benchmark: { cbaElo: 1275 },
  },
  {
    hidden: true, // keep larger model
    id: 'models/gemma-3-1b-it',
    isPreview: true,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_HOTFIX_StripImages, LLM_IF_HOTFIX_Sys0ToUsr0],
    chatPrice: geminiExpFree,
  },

  // LearnLM Experimental Model
  {
    id: 'models/learnlm-2.0-flash-experimental',
    isPreview: true,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: geminiExpFree,
    // hidden: true,
    // _delete: true,
  },


  /// Media Generation Models - NOTE: THESE ARE FILTERED OUT (!) - but here anyway for reference

  // Imagen 3 - Image Generation
  {
    id: 'models/imagen-3.0-generate-002',
    isPreview: false,
    // chatPrice: { input: 0.03, output: 0.03 }, // per image pricing
    interfaces: [LLM_IF_Outputs_Image], // Not a chat model
    hidden: true, // Not accessible through the normal chat interface
  },

  // Veo 2 - Video Generation
  {
    id: 'models/veo-2.0-generate-001',
    isPreview: false,
    // chatPrice: { input: 0.35, output: 0.35 }, // per second pricing
    interfaces: [], // Not a chat model
    hidden: true, // Not accessible through the normal chat interface
  },

];


// Add to your code where you process the API response
export function geminiDevCheckForSuperfluousModels_DEV(apiModelIds: string[]): void {

  if (DEV_DEBUG_GEMINI_MODELS) {

    // editorial model ids
    const expectedModelIds = _knownGeminiModels.map(model => model.id);

    // find editorial models which aren't present in the API response anymore
    const missingModels = expectedModelIds.filter(id => !apiModelIds.includes(id));
    if (missingModels.length > 0)
      console.warn(`Gemini: superfluous model definitions: [ ${missingModels.join(', ')} ]`);

  }

}


/**
 * Checks if Gemini has updated the API.

 * Compares wireModels with parsedModels for missing or mismatched parsed data.
 * @param wireModels is the raw API response from Gemini, containing the .models[] array
 * @param parsedModels is the parsed models array, which should match the wireModels
 */
export function geminiDevCheckForParserMisses_DEV(wireModels: unknown, parsedModels: object[]): void {

  if (DEV_DEBUG_GEMINI_MODELS) {

    // ensure wireModels has .models array
    if (!wireModels || !Array.isArray((wireModels as any)?.models)) {
      console.warn('[DEV] Gemini: wireModels.models is not an array', wireModels);
      return;
    }

    // find differences between wireModels and parsedModels using JSON.stringify
    const wireModelsJson = JSON.stringify((wireModels as any).models);
    const parsedModelsJson = JSON.stringify(parsedModels);
    if (wireModelsJson !== parsedModelsJson)
      console.warn('[DEV] Gemini: wireModels and parsedModels do not match!', wireModelsJson, parsedModelsJson);

  }

}


export function geminiFilterModels(geminiModel: GeminiWire_API_Models_List.Model): boolean {
  const isAllowed = !filterUnallowedNames.some(name => geminiModel.displayName.includes(name));
  // const isSupported = !filterUnallowedInterfaces.some(iface => geminiModel.supportedGenerationMethods.includes(iface));
  const isChatSupported = geminiModel.supportedGenerationMethods.some(iface => geminiChatInterfaces.includes(iface));
  const isWhatItSaysItIs = !filterLyingModelNames.includes(geminiModel.name);
  return isAllowed && isChatSupported && isWhatItSaysItIs;
}


const _sortOderIdPrefix: string[] = [
  'models/gemini-exp',
  'models/gemini-2.5-pro-preview',
  'models/gemini-2.5-pro-exp',
  'models/gemini-2.5-pro',
  'models/gemini-2.5-flash-preview',
  'models/gemini-2.5-flash',
  'models/gemini-2.0-pro',
  'models/gemini-2.0-flash-preview', // -image-generation
  'models/gemini-2.0-flash-exp', // -image-generation
  'models/gemini-2.0-flash-thinking-exp-01-21',
  'models/gemini-2.0-flash-thinking',
  'models/gemini-2.0-flash-live',
  'models/gemini-2.0-flash-0',
  'models/gemini-2.0-flash',
  'models/gemini-2.0-flash-lite',
  'models/gemini-1.5-pro',
  'models/gemini-1.5-flash',
  'models/gemini-1.5-flash-8b',
  'models/gemini-1.0-pro',
  'models/gemini-pro',
  'models/gemma-3n-',
  'models/gemma-3-27b',
  'models/gemma-3-12b',
  'models/gemma-3-4b',
  'models/gemma',
  'models/learnlm',
  'models/imagen',
  'models/veo',
] as const;

export function geminiSortModels(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // links to the bottom
  const aIsLink = a.label.startsWith('🔗');
  const bIsLink = b.label.startsWith('🔗');
  if (aIsLink && !bIsLink) return 1;
  if (!aIsLink && bIsLink) return -1;

  // hidden to the bottom, then names descending
  // if (a.hidden && !b.hidden) return 1;
  // if (!a.hidden && b.hidden) return -1;

  // models beginning with 'gemini-' to the top
  // const aGemini = a.label.startsWith('Gemini');
  // const bGemini = b.label.startsWith('Gemini');
  // if (aGemini && !bGemini) return -1;
  // if (!aGemini && bGemini) return 1;

  // sort by sortOrderIdPrefix
  const aSortIdx = _sortOderIdPrefix.findIndex(p => a.id.startsWith(p));
  const bSortIdx = _sortOderIdPrefix.findIndex(p => b.id.startsWith(p));
  if (aSortIdx !== -1 && bSortIdx !== -1) {
    if (aSortIdx < bSortIdx) return -1;
    if (aSortIdx > bSortIdx) return 1;
  }

  // sort by label descending
  return b.label.localeCompare(a.label);
}


export function geminiModelToModelDescription(geminiModel: GeminiWire_API_Models_List.Model): ModelDescriptionSchema | null {
  const { description, displayName, name: modelId, supportedGenerationMethods } = geminiModel;

  // if (DEV_DEBUG_GEMINI_MODELS)
  //   console.log('geminiModelToModelDescription', geminiModel);

  // handle unsupported interfaces
  const hasChatInterfaces = supportedGenerationMethods.some(iface => geminiChatInterfaces.includes(iface));
  if (!hasChatInterfaces) {
    if (DEV_DEBUG_GEMINI_MODELS)
      console.warn(`geminiModelToModelDescription: no chat interfaces (${supportedGenerationMethods.join(', ')}) for model ${modelId} (${displayName}) - skipping.`);
    return null; // skip models without chat interfaces
  }


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
  const hidden = knownModel?.hidden || !!knownModel?.symLink || !hasChatInterfaces;

  // context window
  const { inputTokenLimit, outputTokenLimit } = geminiModel;
  const contextWindow = inputTokenLimit + outputTokenLimit;

  // description
  const { version, topK, topP, temperature } = geminiModel;
  const descriptionLong = (description || 'No description.') + ` (Version: ${version}, Defaults: temperature=${temperature}, topP=${topP}, topK=${topK}, interfaces=[${supportedGenerationMethods.join(',')}])`;

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


const hardcodedGeminiVariants: { [modelId: string]: Partial<ModelDescriptionSchema>[] } = {

  // Adding non-thinking variant for the newest Gemini 2.5 Flash Preview 05-20 model
  'models/gemini-2.5-flash-preview-05-20': [{
    idVariant: '-non-thinking',
    label: 'Gemini 2.5 Flash Preview (Non-thinking, 05-20)',
    chatPrice: gemini25FlashPreviewNonThinkingPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, /*LLM_IF_OAI_Reasoning,*/ LLM_IF_GEM_CodeExecution],
    parameterSpecs: [{
      paramId: 'llmVndGeminiThinkingBudget',
      hidden: true,
      initialValue: 0, // non-thinking: we fix the thinking budget to 0
    }],
    hidden: true,
  }],

  // Changes to the thinking variant (same model ID) for the Gemini 2.5 Flash Preview model
  'models/gemini-2.5-flash-preview-04-17': [{
    idVariant: '-non-thinking',
    label: 'Gemini 2.5 Flash Preview (Non-thinking, 04-17)',
    chatPrice: gemini25FlashPreviewNonThinkingPricing,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, /*LLM_IF_OAI_Reasoning,*/ LLM_IF_GEM_CodeExecution],
    parameterSpecs: [{
      paramId: 'llmVndGeminiThinkingBudget',
      hidden: true,
      initialValue: 0, // non-thinking: we fix the thinking budget to 0
    }],
    hidden: true,
  }],

} as const;

export function geminiModelsAddVariants(models: ModelDescriptionSchema[]): ModelDescriptionSchema[] {
  return models.reduce((acc, model) => {

    // insert the model in the same order
    acc.push(model);

    // add variants, if defined
    if (hardcodedGeminiVariants[model.id])
      for (const variant of hardcodedGeminiVariants[model.id])
        acc.push({
          ...model,
          ...variant,
        });

    return acc;
  }, [] as ModelDescriptionSchema[]);
}
