import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


export interface DZAIServiceSettings {
  zaiKey: string;
  zaiHost: string;
  csf?: boolean; // stored by earlier versions, not read while Direct Connection is not offered (see below)
}

export const ModelVendorZAI: IModelVendor<DZAIServiceSettings, OpenAIAccessSchema> = {
  id: 'zai',
  name: 'Z.ai',
  displayRank: 17,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,

  // NOTE: no `csfAvailable` - the chat endpoint answers the browser's CORS preflight without an allow-origin, so a
  // browser-direct chat cannot start (the models endpoint still allows it): server-only until
  // the csf-cors-checker job (tools/jobs/) reports it open again
  csfOffReason: () => 'Z.ai does not allow it',

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
    clientSideFetch: false, // server-only (no CSF)
    oaiKey: partialSetup?.zaiKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.zaiHost || '',
  }),

  // OpenAI transport ('zai' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};
