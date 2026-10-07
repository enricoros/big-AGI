import type { IT2IVendor } from '../IT2IVendor';
import { geminiImageModelLabel } from '../gemini/geminiImageModels';


export const T2IVendorGemini: IT2IVendor<'googleai'> = {
  vendorType: 'googleai',
  name: 'Gemini',
  description: 'Gemini Nano Banana image models',
  priority: 35, // below direct OpenAI configs, above OpenRouter

  // Auto-link: configured Gemini LLM service -> T2I engine sharing the key (also a server-side env key: generation is server-routed)
  autoFromLlmVendorIds: [
    'googleai',
  ],

  capabilities: {
    imageEditing: true, // reference images are sent with the prompt (up to 14 on Nano Banana 2.1)
    multiImage: false,  // one image per request - the client fans out instead
  },

  // placeholder - engines are only created auto-linked today (sync passes credentials)
  getDefaultCredentials: () => ({
    type: 'llms-service',
    serviceId: '',
  }),

  getDefaultProfile: () => ({
    dialect: 'gemini',
    imageModelRef: null, // auto = the service's first image model
  }),

  generatorName: (profile) => geminiImageModelLabel(profile.imageModelRef),
};
