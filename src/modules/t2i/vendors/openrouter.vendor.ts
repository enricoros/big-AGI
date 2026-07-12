import type { IT2IVendor } from '../IT2IVendor';
import { openRouterImageModelLabel } from '../t2i.config';


export const T2IVendorOpenRouter: IT2IVendor<'openrouter'> = {
  vendorType: 'openrouter',
  name: 'OpenRouter',
  description: 'OpenRouter Image generation models',
  priority: 40, // below direct OpenAI configs

  // Auto-link: configured OpenRouter LLM service -> T2I engine sharing the key
  autoFromLlmVendorIds: [
    'openrouter',
  ],

  capabilities: {
    imageEditing: false, // not through the dedicated image API yet
    multiImage: false,   // most models cap n at 1 - the client fans out instead
  },

  // placeholder - engines are only created auto-linked today (sync passes credentials)
  getDefaultCredentials: () => ({
    type: 'llms-service',
    serviceId: '',
  }),

  getDefaultProfile: () => ({
    dialect: 'openrouter',
    imageModelId: null, // auto = first model in the curated list
  }),

  generatorName: (profile) => openRouterImageModelLabel(profile.imageModelId),
};
