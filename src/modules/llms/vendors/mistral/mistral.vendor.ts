import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { DOpenAIServiceSettings, ModelVendorOpenAI } from '../openai/openai.vendor';


// special symbols

type DMistralServiceSettings = Pick<DOpenAIServiceSettings, 'oaiKey' | 'oaiHost' | 'csf'>;


/** Implementation Notes for the Mistral vendor
 */
export const ModelVendorMistral: IModelVendor<DMistralServiceSettings, OpenAIAccessSchema> = {
  id: 'mistral',
  name: 'Mistral',
  displayRank: 18,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmMistral',

  /// client-side-fetch ///
  csfAvailable: _csfMistralAvailable,

  // functions
  initializeSetup: () => ({
    oaiHost: 'https://api.mistral.ai/',
    oaiKey: '',
  }),
  validateSetup: (setup) => {
    return setup.oaiKey?.length >= 32;
  },
  getTransportAccess: (partialSetup): OpenAIAccessSchema => ({
    dialect: 'mistral',
    clientSideFetch: _csfMistralAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.oaiKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.oaiHost || '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('mistral' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfMistralAvailable(s?: Partial<DMistralServiceSettings>) {
  return !!s?.oaiKey;
}