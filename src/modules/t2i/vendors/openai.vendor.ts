import type { DOpenAIServiceSettings } from '~/modules/llms/vendors/openai/openai.vendor';
import { llmsIsNativeOpenAIHost } from '~/modules/llms/shared/llm.isomorphic';

import type { IT2IVendor } from '../IT2IVendor';
import { openAIImageModelsGeneratorName } from '../dalle/openaiGenerateImages';
import { t2iDefaultDalleProfile } from '../t2i.config';


export const T2IVendorOpenAI: IT2IVendor<'openai'> = {
  vendorType: 'openai',
  name: 'OpenAI',
  description: 'OpenAI Image generation models',
  priority: 30,

  // Auto-link: configured OpenAI LLM service -> T2I engine sharing the key
  autoFromLlmVendorIds: [
    'openai',
  ],

  // Skip auto-link when oaiHost is set to a non-OpenAI endpoint. OpenAI-compatible
  // proxies (ChutesAI, MiniMax, self-hosted, ...) advertise the chat/completions
  // surface but usually don't implement /v1/images/generations.
  shouldAutoLinkFromLLMSource: (source) => {
    return llmsIsNativeOpenAIHost((source?.setup as Partial<DOpenAIServiceSettings> | undefined)?.oaiHost?.trim());
  },

  capabilities: {
    imageEditing: true, // GPT Image family
    multiImage: true,   // up to 10, except DALL·E 3
  },

  // placeholder - engines are only created auto-linked today (sync passes credentials)
  getDefaultCredentials: () => ({
    type: 'llms-service',
    serviceId: '',
  }),

  getDefaultProfile: t2iDefaultDalleProfile,

  generatorName: (profile) => openAIImageModelsGeneratorName(profile.dalleModelId),
};
