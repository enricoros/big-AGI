import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


interface DGroqServiceSettings {
  groqKey: string;
  csf?: boolean;
}

export const ModelVendorGroq: IModelVendor<DGroqServiceSettings, OpenAIAccessSchema> = {
  id: 'groq',
  name: 'Groq',
  displayRank: 32,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmGroq',

  /// client-side-fetch ///
  csfAvailable: _csfGroqAvailable,

  // functions
  initializeSetup: () => ({
    groqKey: '',
  }),
  validateSetup: (setup) => {
    return setup.groqKey?.length >= 50;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'groq',
    clientSideFetch: _csfGroqAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.groqKey || '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('Groq' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfGroqAvailable(s?: Partial<DGroqServiceSettings>) {
  return !!s?.groqKey;
}
