import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


export interface DLLMAPIServiceSettings {
  llmapiKey: string;
}

export const ModelVendorLLMAPI: IModelVendor<DLLMAPIServiceSettings, OpenAIAccessSchema> = {
  id: 'llmapi',
  name: 'LLM API',
  displayRank: 18,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,

  // functions
  initializeSetup: () => ({
    llmapiKey: '',
  }),
  validateSetup: (setup) => {
    return setup.llmapiKey?.length >= 10;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'llmapi',
    oaiKey: partialSetup?.llmapiKey || '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
  }),

  // OpenAI transport ('llmapi' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};
