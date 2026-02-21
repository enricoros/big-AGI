import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


interface DLLMAPIServiceSettings {
  llmapiKey: string;
  csf?: boolean;
}

export const ModelVendorLLMAPI: IModelVendor<DLLMAPIServiceSettings, OpenAIAccessSchema> = {
  id: 'llmapi',
  name: 'LLM API',
  displayRank: 41,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmLLMAPI',

  /// client-side-fetch ///
  csfAvailable: _csfLLMAPIAvailable,

  // functions
  initializeSetup: () => ({
    llmapiKey: '',
  }),
  validateSetup: (setup) => {
    return setup.llmapiKey?.length >= 8;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'llmapi',
    clientSideFetch: _csfLLMAPIAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.llmapiKey || '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
  }),

  // OpenAI transport ('llmapi' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfLLMAPIAvailable(s?: Partial<DLLMAPIServiceSettings>) {
  return !!s?.llmapiKey;
}
