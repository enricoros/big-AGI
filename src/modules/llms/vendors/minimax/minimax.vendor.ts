import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


export interface DMiniMaxServiceSettings {
  minimaxKey: string;
  minimaxHost: string;
  csf?: boolean;
}

export const ModelVendorMiniMax: IModelVendor<DMiniMaxServiceSettings, OpenAIAccessSchema> = {
  id: 'minimax',
  name: 'MiniMax',
  displayRank: 33,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmMiniMax',

  /// client-side-fetch ///
  csfAvailable: _csfMiniMaxAvailable,

  // functions
  initializeSetup: () => ({
    minimaxKey: '',
    minimaxHost: '',
  }),
  validateSetup: (setup) => {
    return setup.minimaxKey?.length >= 32;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'minimax',
    clientSideFetch: _csfMiniMaxAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.minimaxKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.minimaxHost || '',
    heliKey: '',
  }),

  // OpenAI transport ('minimax' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfMiniMaxAvailable(s?: Partial<DMiniMaxServiceSettings>) {
  return !!s?.minimaxKey;
}
