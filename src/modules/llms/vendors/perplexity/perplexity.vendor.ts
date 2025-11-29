import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


interface DPerpexityServiceSettings {
  perplexityKey: string;
  csf?: boolean;
}

export const ModelVendorPerplexity: IModelVendor<DPerpexityServiceSettings, OpenAIAccessSchema> = {
  id: 'perplexity',
  name: 'Perplexity',
  displayRank: 20,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmPerplexity',

  /// client-side-fetch ///
  csfAvailable: _csfPerplexityAvailable,

  // functions
  initializeSetup: () => ({
    perplexityKey: '',
  }),
  validateSetup: (setup) => {
    return setup.perplexityKey?.length >= 50;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'perplexity',
    clientSideFetch: _csfPerplexityAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.perplexityKey || '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('perplexity' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfPerplexityAvailable(s?: Partial<DPerpexityServiceSettings>) {
  return !!s?.perplexityKey;
}
