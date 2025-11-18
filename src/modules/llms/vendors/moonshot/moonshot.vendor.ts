import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


interface DMoonshotServiceSettings {
  moonshotKey: string;
}

export const ModelVendorMoonshot: IModelVendor<DMoonshotServiceSettings, OpenAIAccessSchema> = {
  id: 'moonshot',
  name: 'Moonshot AI',
  displayRank: 34,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmMoonshot',

  // functions
  initializeSetup: () => ({
    moonshotKey: '',
  }),
  validateSetup: (setup) => {
    return setup.moonshotKey?.length >= 20;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'moonshot',
    oaiKey: partialSetup?.moonshotKey || '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('moonshot' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};
