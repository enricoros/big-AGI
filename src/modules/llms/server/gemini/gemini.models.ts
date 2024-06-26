import type { GeminiModelSchema } from './gemini.wiretypes';
import type { ModelDescriptionSchema } from '../llm.server.types';
import { LLM_IF_OAI_Chat, LLM_IF_OAI_Json, LLM_IF_OAI_Vision } from '../../store-llms';


// dev options
const DEV_DEBUG_GEMINI_MODELS = false;


// supported interfaces
const geminiChatInterfaces: GeminiModelSchema['supportedGenerationMethods'] = ['generateContent'];

// unsupported interfaces
const filterUnallowedNames = ['Legacy'];
const filterUnallowedInterfaces: GeminiModelSchema['supportedGenerationMethods'] = ['generateAnswer', 'embedContent', 'embedText'];


/* Manual models details
   Gemini Name Mapping example:
   - Latest version    gemini-1.0-pro-latest    <model>-<generation>-<variation>-latest
   - Latest stable     version  gemini-1.0-pro  <model>-<generation>-<variation>
   - Stable versions   gemini-1.0-pro-001       <model>-<generation>-<variation>-<version>
*/
const _knownGeminiModels: ({
  id: string,
  isNewest?: boolean,
  isPreview?: boolean
  symLink?: string
} & Pick<ModelDescriptionSchema, 'interfaces' | 'pricing' | 'trainingDataCutoff' | 'hidden'>)[] = [

  // Generation 1.5
  {
    id: 'models/gemini-1.5-flash-latest', // updated regularly and might be a preview version
    isNewest: true,
    isPreview: true,
    pricing: {
      chatIn: 0.70,   // 0.35 up to 128k tokens, 0.70 prompts > 128k tokens
      chatOut: 2.10,  // 1.05 up to 128k tokens, 2.10 prompts > 128k tokens
    },
    trainingDataCutoff: 'May 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json], // input: audio, images and text
  },
  {
    id: 'models/gemini-1.5-flash',
    // copied from above
    pricing: {
      chatIn: 0.70,   // 0.35 up to 128k tokens, 0.70 prompts > 128k tokens
      chatOut: 2.10,  // 1.05 up to 128k tokens, 2.10 prompts > 128k tokens
    },
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json], // input: audio, images and text
    hidden: true,
  },
  {
    id: 'models/gemini-1.5-flash-001',
    // copied from above
    pricing: {
      chatIn: 0.70,   // 0.35 up to 128k tokens, 0.70 prompts > 128k tokens
      chatOut: 2.10,  // 1.05 up to 128k tokens, 2.10 prompts > 128k tokens
    },
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json], // input: audio, images and text
    hidden: true,
  },

  {
    id: 'models/gemini-1.5-pro-latest', // updated regularly and might be a preview version
    isNewest: true,
    isPreview: true,
    pricing: {
      chatIn: 7.00,   // $3.50 / 1 million tokens (for prompts up to 128K tokens), $7.00 / 1 million tokens (for prompts longer than 128K)
      chatOut: 21.00, // $10.50 / 1 million tokens (128K or less), $21.00 / 1 million tokens (128K+)
    },
    trainingDataCutoff: 'May 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json], // input: audio, images and text
  },
  {
    id: 'models/gemini-1.5-pro', // latest stable -> 001
    // copied from above
    pricing: {
      chatIn: 7.00,   // $3.50 / 1 million tokens (for prompts up to 128K tokens), $7.00 / 1 million tokens (for prompts longer than 128K)
      chatOut: 21.00, // $10.50 / 1 million tokens (128K or less), $21.00 / 1 million tokens (128K+)
    },
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json],
    hidden: true,
  },
  {
    id: 'models/gemini-1.5-pro-001', // stable snapshot
    // copied from above
    pricing: {
      chatIn: 7.00,   // $3.50 / 1 million tokens (for prompts up to 128K tokens), $7.00 / 1 million tokens (for prompts longer than 128K)
      chatOut: 21.00, // $10.50 / 1 million tokens (128K or less), $21.00 / 1 million tokens (128K+)
    },
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json],
    hidden: true,
  },


  // Generation 1.0
  {
    id: 'models/gemini-1.0-pro-latest',
    pricing: {
      chatIn: 0.50,
      chatOut: 1.50,
    },
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    id: 'models/gemini-1.0-pro',
    pricing: {
      chatIn: 0.50,
      chatOut: 1.50,
    },
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
  {
    id: 'models/gemini-1.0-pro-001',
    pricing: {
      chatIn: 0.50,
      chatOut: 1.50,
    },
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },

  // Generation 1.0 + Vision
  {
    id: 'models/gemini-1.0-pro-vision-latest',
    pricing: {
      chatIn: 0.50,
      chatOut: 1.50,
    },
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision], // Text and Images
    hidden: true,
  },

  // Older symlinks
  {
    id: 'models/gemini-pro',
    symLink: 'models/gemini-1.0-pro',
    // copied from symlinked
    pricing: {
      chatIn: 0.50,
      chatOut: 1.50,
    },
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
  {
    id: 'models/gemini-pro-vision',
    // copied from symlinked
    symLink: 'models/gemini-1.0-pro-vision',
    pricing: {
      chatIn: 0.50,
      chatOut: 1.50,
    },
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision], // Text and Images
    hidden: true,
  },
];


export function geminiFilterModels(geminiModel: GeminiModelSchema): boolean {
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

export function geminiModelToModelDescription(geminiModel: GeminiModelSchema): ModelDescriptionSchema {
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
    interfaces.push(LLM_IF_OAI_Chat);
    // if (geminiVisionNames.some(name => modelId.includes(name)))
    //   interfaces.push(LLM_IF_OAI_Vision);
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
    pricing: knownModel?.pricing, // TODO: needs <>128k, and per-character and per-image pricing
    hidden,
  };
}
