import type { IT2IVendor } from '../IT2IVendor';
import { openAIImageModelsGeneratorName } from '../dalle/openaiGenerateImages';
import { t2iDefaultDalleProfile } from '../t2i.config';


export const T2IVendorAzure: IT2IVendor<'azure'> = {
  vendorType: 'azure',
  name: 'Azure OpenAI',
  description: 'Azure OpenAI Image generation models',
  priority: 30 - 2, // assuming custom Azure OpenAI configs are preferred over OpenAI

  // Auto-link: configured Azure LLM service -> T2I engine sharing the key
  autoFromLlmVendorIds: [
    'azure',
  ],

  capabilities: {
    imageEditing: true, // GPT Image family
    multiImage: true,
  },

  // placeholder - engines are only created auto-linked today (sync passes credentials)
  getDefaultCredentials: () => ({
    type: 'llms-service',
    serviceId: '',
  }),

  getDefaultProfile: t2iDefaultDalleProfile,

  generatorName: (profile) => openAIImageModelsGeneratorName(profile.dalleModelId),
};
