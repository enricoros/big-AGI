import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


interface DPerpexityServiceSettings {
  perplexityKey: string;
  csf?: boolean; // stored by earlier versions, not read while Direct Connection is not offered (see below)
}

export const ModelVendorPerplexity: IModelVendor<DPerpexityServiceSettings, OpenAIAccessSchema> = {
  id: 'perplexity',
  name: 'Perplexity',
  displayRank: 20,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmPerplexity',

  // NOTE: no `csfAvailable` - api.perplexity.ai sends CORS headers on the preflight and on its errors, but not on a
  // successful response, so the browser cannot read an answer: server-only until
  // the csf-cors-checker job (tools/jobs/) reports it open again

  // functions
  initializeSetup: () => ({
    perplexityKey: '',
  }),
  validateSetup: (setup) => {
    return setup.perplexityKey?.length >= 50;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'perplexity',
    clientSideFetch: false, // server-only (no CSF)
    oaiKey: partialSetup?.perplexityKey || '',
    oaiOrg: '',
    oaiHost: '',
  }),

  // OpenAI transport ('perplexity' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};
