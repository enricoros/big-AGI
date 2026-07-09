import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


export interface DCohereServiceSettings {
  cohereKey: string;
  cohereHost: string;
  csf?: boolean;
}

export const ModelVendorCohere: IModelVendor<DCohereServiceSettings, OpenAIAccessSchema> = {
  id: 'cohere',
  name: 'Cohere',
  displayRank: 33,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,

  /// client-side-fetch ///
  csfAvailable: _csfCohereAvailable,

  // functions
  initializeSetup: () => ({
    cohereKey: '',
    cohereHost: '',
  }),
  validateSetup: (setup) => {
    return setup.cohereKey?.length >= 20;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'cohere',
    clientSideFetch: _csfCohereAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.cohereKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.cohereHost || '',
    heliKey: '',
  }),

  // OpenAI transport ('cohere' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfCohereAvailable(s?: Partial<DCohereServiceSettings>) {
  return !!s?.cohereKey;
}
