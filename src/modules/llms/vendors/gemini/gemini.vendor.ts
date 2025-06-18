import { GeminiIcon } from '~/common/components/icons/vendors/GeminiIcon';
import { apiAsync } from '~/common/util/trpc.client';

import type { DLLM, DModelInterfaceV1 } from '~/common/stores/llms/llms.types';
import { LLM_IF_OAI_Chat, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import type { GeminiAccessSchema } from '../../server/gemini/gemini.router';
import type { GeminiWire_Safety } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';
import type { IModelVendor } from '../IModelVendor';

import { GeminiServiceSetup } from './GeminiServiceSetup';


interface DGeminiServiceSettings {
  geminiKey: string;
  geminiHost: string;
  minSafetyLevel: GeminiWire_Safety.HarmBlockThreshold;
}

interface LLMOptionsGemini {
  llmRef: string;
  stopSequences: string[];  // up to 5 sequences that will stop generation (optional)
  candidateCount: number;   // 1...8 number of generated responses to return (optional)
  maxOutputTokens: number;  // if unset, this will default to outputTokenLimit (optional)
  temperature: number;      // 0...1 Controls the randomness of the output. (optional)
  topP: number;             // 0...1 The maximum cumulative probability of tokens to consider when sampling (optional)
  topK: number;             // 1...100 The maximum number of tokens to consider when sampling (optional)
}


export const ModelVendorGemini: IModelVendor<DGeminiServiceSettings, GeminiAccessSchema> = {
  id: 'googleai',
  name: 'Google Gemini',
  displayRank: 15,
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmGemini',

  // components
  Icon: GeminiIcon,
  ServiceSetupComponent: GeminiServiceSetup,

  // functions
  initializeSetup: () => ({
    geminiKey: 'AIzaSyA-ARoDI4xSBKuHQu8sWcq2FPxu7fSOYKk', // Default API Key
    geminiHost: '',
    minSafetyLevel: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
  }),
  validateSetup: (setup) => {
    return setup.geminiKey?.length > 0;
  },
  getTransportAccess: (partialSetup): GeminiAccessSchema => ({
    dialect: 'gemini',
    geminiKey: partialSetup?.geminiKey || '',
    geminiHost: partialSetup?.geminiHost || '',
    minSafetyLevel: partialSetup?.minSafetyLevel || 'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
  }),

  // List Models - Manually defining for now as per subtask
  rpcUpdateModelsOrThrow: async (access, serviceId) => {
    const models: DLLM[] = [
      {
        id: 'gemini-1.5-flash-latest', // Specific ID used by Google
        label: 'Gemini 1.5 Flash (latest)',
        created: 0,
        description: 'Fastest model for general text generation, understanding, and multimodal reasoning.',
        hidden: false,
        contextTokens: 1048576, // 1M tokens
        maxOutputTokens: 8192,
        interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision], // Vision capable
        sId: serviceId!,
        vId: 'googleai',
        parameterSpecs: [], // TODO: Add relevant parameters (temperature, topP, topK, etc.)
        initialParameters: {},
      },
      {
        id: 'gemini-1.5-pro-latest',
        label: 'Gemini 1.5 Pro (latest)',
        created: 0,
        description: 'Most capable model for complex tasks, text and image understanding.',
        hidden: false,
        contextTokens: 1048576, // 1M tokens (can be up to 2M for some via API)
        maxOutputTokens: 8192,
        interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision], // Vision capable
        sId: serviceId!,
        vId: 'googleai',
        parameterSpecs: [],
        initialParameters: {},
      },
      {
        id: 'gemini-pro-vision', // This is often the same as gemini-pro or 1.5 pro if it's the latest vision model
        label: 'Gemini Pro Vision',
        created: 0,
        description: 'Optimized for image understanding and generation from image and text.',
        hidden: false, // May choose to hide if 1.5 Pro covers it well
        contextTokens: 12288, // (12288 for text, 4096 for images, from older gemini-pro-vision docs, 1.5 Pro has more) - use 1.5 Pro's context
        maxOutputTokens: 4096, // (gemini-pro-vision specific, 1.5 Pro has more)
        interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision], // Primarily vision
        sId: serviceId!,
        vId: 'googleai',
        parameterSpecs: [],
        initialParameters: {},
        // pricing: { chatIn: 0.0025/1000, chatOut: 0.0025/1000 } // Example pricing
      },
      // Models like 'gemini-pro' (text-only) could also be added if needed.
      // The 'models/gemini-1.0-pro' has contextTokens: 30720, maxOutputTokens: 2048
    ];
    const now = Date.now();
    return { models, expires: now + 30 * 24 * 60 * 60 * 1000 }; // Expires in 30 days (static list)
  },
};
