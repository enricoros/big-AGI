import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


interface DCerebrasServiceSettings {
  cerebrasKey: string;
  csf?: boolean;
}

export const ModelVendorCerebras: IModelVendor<DCerebrasServiceSettings, OpenAIAccessSchema> = {
  id: 'cerebras',
  name: 'Cerebras',
  displayRank: 33,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmCerebras',

  /// client-side-fetch ///
  csfAvailable: _csfCerebrasAvailable,

  // functions
  initializeSetup: () => ({
    cerebrasKey: '',
  }),
  validateSetup: (setup) => {
    return setup.cerebrasKey?.length >= 40;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'cerebras',
    clientSideFetch: _csfCerebrasAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.cerebrasKey || '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
  }),

  // OpenAI transport ('cerebras' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfCerebrasAvailable(s?: Partial<DCerebrasServiceSettings>) {
  return !!s?.cerebrasKey;
}
