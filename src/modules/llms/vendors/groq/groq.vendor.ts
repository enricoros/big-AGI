import { GroqIcon } from '~/common/components/icons/vendors/GroqIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { ModelVendorOpenAI } from '../openai/openai.vendor';

import { GroqServiceSetup } from './GroqServiceSetup';


interface DGroqServiceSettings {
  groqKey: string;
}

export const ModelVendorGroq: IModelVendor<DGroqServiceSettings, OpenAIAccessSchema> = {
  id: 'groq',
  name: 'Groq',
  displayRank: 32,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCapKey: 'hasLlmGroq',

  // components
  Icon: GroqIcon,
  ServiceSetupComponent: GroqServiceSetup,

  // functions
  initializeSetup: () => ({
    groqKey: '',
  }),
  validateSetup: (setup) => {
    return setup.groqKey?.length >= 50;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'groq',
    oaiKey: partialSetup?.groqKey || '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('Groq' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};
