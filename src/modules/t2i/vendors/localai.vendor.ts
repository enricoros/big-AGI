import type { IT2IVendor } from '../IT2IVendor';
import { t2iDefaultDalleProfile } from '../t2i.config';


export const T2IVendorLocalAI: IT2IVendor<'localai'> = {
  vendorType: 'localai',
  name: 'LocalAI',
  description: 'LocalAI\'s models',
  priority: 20, // LocalAI preferred over cloud services, if configured

  // Auto-link: configured LocalAI LLM service -> T2I engine sharing the host
  autoFromLlmVendorIds: [
    'localai',
  ],

  capabilities: {
    imageEditing: false,
    multiImage: true,
  },

  // placeholder - engines are only created auto-linked today (sync passes credentials)
  getDefaultCredentials: () => ({
    type: 'llms-service',
    serviceId: '',
  }),

  // TODO: LocalAI deserves its own profile + dedicated panel (dynamic model listing
  // via the gallery endpoints) instead of piggybacking on the DALL·E profile with the
  // temporary model-name mapping in openaiGenerateImages.ts
  getDefaultProfile: t2iDefaultDalleProfile,

  generatorName: () => 'LocalAI',
};
