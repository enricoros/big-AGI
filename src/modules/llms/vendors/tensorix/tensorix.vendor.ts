import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


export interface DTensorixServiceSettings {
  tensorixKey: string;
  tensorixHost: string;
  csf?: boolean;
}

export const ModelVendorTensorix: IModelVendor<DTensorixServiceSettings, OpenAIAccessSchema> = {
  id: 'tensorix',
  name: 'Tensorix',
  displayRank: 18,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmTensorix',

  /// client-side-fetch ///
  csfAvailable: _csfTensorixAvailable,

  // functions
  initializeSetup: () => ({
    tensorixKey: '',
    tensorixHost: '',
  }),
  validateSetup: (setup) => {
    return setup.tensorixKey?.length >= 20;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'tensorix',
    clientSideFetch: _csfTensorixAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.tensorixKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.tensorixHost || '',
    heliKey: '',
  }),

  // OpenAI transport ('tensorix' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfTensorixAvailable(s?: Partial<DTensorixServiceSettings>) {
  return !!s?.tensorixKey;
}
