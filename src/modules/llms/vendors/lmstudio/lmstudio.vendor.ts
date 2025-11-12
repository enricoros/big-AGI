import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


interface DLMStudioServiceSettings {
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
}

export const ModelVendorLMStudio: IModelVendor<DLMStudioServiceSettings, OpenAIAccessSchema> = {
  id: 'lmstudio',
  name: 'LM Studio',
  displayRank: 52,
  displayGroup: 'local',
  location: 'local',
  instanceLimit: 1,

  // functions
  initializeSetup: () => ({
    oaiHost: 'http://localhost:1234',
  }),
  getTransportAccess: (partialSetup) => ({
    dialect: 'lmstudio',
    oaiKey: '',
    oaiOrg: '',
    oaiHost: partialSetup?.oaiHost || '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('lmstudio' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};
