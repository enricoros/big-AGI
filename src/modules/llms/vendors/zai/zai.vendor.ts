import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


export interface DZAIServiceSettings {
  zaiKey: string;
  zaiHost: string;
  csf?: boolean;
}

export const ModelVendorZAI: IModelVendor<DZAIServiceSettings, OpenAIAccessSchema> = {
  id: 'zai',
  name: 'Z.ai',
  displayRank: 17,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,

  /// client-side-fetch ///
  csfAvailable: _csfZAIAvailable,

  // functions
  initializeSetup: () => ({
    zaiKey: '',
    zaiHost: '',
  }),
  validateSetup: (setup) => {
    return setup.zaiKey?.length >= 30;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'zai',
    clientSideFetch: _csfZAIAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.zaiKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.zaiHost || '',
    heliKey: '',
  }),

  // OpenAI transport ('zai' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfZAIAvailable(s?: Partial<DZAIServiceSettings>) {
  return !!s?.zaiKey;
}
