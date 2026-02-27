import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


export interface DAvianServiceSettings {
  avianKey: string;
  csf?: boolean;
}

export const ModelVendorAvian: IModelVendor<DAvianServiceSettings, OpenAIAccessSchema> = {
  id: 'avian',
  name: 'Avian',
  displayRank: 33,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmAvian',

  /// client-side-fetch ///
  csfAvailable: _csfAvianAvailable,

  // functions
  initializeSetup: () => ({
    avianKey: '',
  }),
  validateSetup: (setup) => {
    return setup.avianKey?.length >= 8;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'avian',
    clientSideFetch: _csfAvianAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.avianKey || '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
  }),

  // OpenAI transport ('Avian' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfAvianAvailable(s?: Partial<DAvianServiceSettings>) {
  return !!s?.avianKey;
}
