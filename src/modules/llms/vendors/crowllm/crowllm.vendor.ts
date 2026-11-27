import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


/** CrowLLM is an OpenAI-compatible gateway: one host and one key for models from several labs. */
interface DCrowLLMServiceSettings {
  oaiKey: string;
  oaiHost: string;
  csf?: boolean;
}

export const ModelVendorCrowLLM: IModelVendor<DCrowLLMServiceSettings, OpenAIAccessSchema> = {
  id: 'crowllm',
  name: 'CrowLLM',
  displayRank: 41,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,

  /// client-side-fetch ///
  csfAvailable: _csfCrowLLMAvailable,

  // functions
  initializeSetup: (): DCrowLLMServiceSettings => ({
    oaiHost: 'https://crowllm.com',
    oaiKey: '',
  }),
  validateSetup: (setup) => {
    return setup.oaiKey?.length >= 8;
  },
  getTransportAccess: (partialSetup): OpenAIAccessSchema => ({
    dialect: 'openai',
    clientSideFetch: _csfCrowLLMAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.oaiKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.oaiHost || '',
  }),

  // OpenAI-compatible transport (key + host)
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,
};

function _csfCrowLLMAvailable(s?: Partial<DCrowLLMServiceSettings>) {
  return !!s?.oaiKey;
}
