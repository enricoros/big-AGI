import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


export interface DDeepseekServiceSettings {
  deepseekKey: string;
  csf?: boolean;
}

export const ModelVendorDeepseek: IModelVendor<DDeepseekServiceSettings, OpenAIAccessSchema> = {
  id: 'deepseek',
  name: 'Deepseek',
  displayRank: 16,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmDeepseek',

  /// client-side-fetch ///
  csfAvailable: _csfDeepseekAvailable,

  // functions
  initializeSetup: () => ({
    deepseekKey: '',
  }),
  validateSetup: (setup) => {
    return setup.deepseekKey?.length >= 35;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'deepseek',
    clientSideFetch: _csfDeepseekAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.deepseekKey || '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('Deepseek' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfDeepseekAvailable(s?: Partial<DDeepseekServiceSettings>) {
  return !!s?.deepseekKey;
}
