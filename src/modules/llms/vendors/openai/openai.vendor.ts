import { apiAsync } from '~/common/util/trpc.client';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';


// special symbols
// export const isValidOpenAIApiKey = (apiKey?: string) => !!apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;

export interface DOpenAIServiceSettings {
  oaiKey: string;
  oaiOrg: string;
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
  csf?: boolean;
  heliKey: string;  // helicone key (works in conjunction with oaiHost)
  moderationCheck: boolean;
}

export const ModelVendorOpenAI: IModelVendor<DOpenAIServiceSettings, OpenAIAccessSchema> = {
  id: 'openai',
  name: 'OpenAI',
  displayRank: 10,
  displayGroup: 'popular',
  location: 'cloud',
  instanceLimit: 5,
  hasServerConfigKey: 'hasLlmOpenAI',

  /// client-side-fetch ///
  csfAvailable: _csfOpenAIAvailable,

  // functions
  getTransportAccess: (partialSetup): OpenAIAccessSchema => ({
    dialect: 'openai',
    clientSideFetch: _csfOpenAIAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
    ...partialSetup,
  }),

  // List Models
  rpcUpdateModelsOrThrow: async (access) => await apiAsync.llmOpenAI.listModels.query({ access }),

};

function _csfOpenAIAvailable(s?: Partial<DOpenAIServiceSettings>) {
  return !!(s?.oaiHost || s?.oaiKey);
}
