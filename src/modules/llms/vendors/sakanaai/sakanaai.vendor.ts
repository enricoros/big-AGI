import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


export interface DSakanaAIServiceSettings {
  sakanaKey: string;
  sakanaHost: string;
}

export const ModelVendorSakanaAI: IModelVendor<DSakanaAIServiceSettings, OpenAIAccessSchema> = {
  id: 'sakanaai',
  name: 'Sakana AI',
  displayRank: 18,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,

  // NOTE: no `csfAvailable` - Sakana's API does not allow browser-direct (CORS) requests, so this vendor is server-only

  // functions
  initializeSetup: () => ({
    sakanaKey: '',
    sakanaHost: '',
  }),
  validateSetup: (setup) => {
    return setup.sakanaKey?.length >= 40;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'sakanaai',
    clientSideFetch: false, // server-only (no CSF)
    oaiKey: partialSetup?.sakanaKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.sakanaHost || '',
    heliKey: '',
  }),

  // OpenAI transport ('sakanaai' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};
