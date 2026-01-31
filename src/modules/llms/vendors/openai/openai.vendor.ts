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

  // Note: `moderationCheck: boolean` was removed from UI/new clients;
  // old stored data may still contain it and is passed through to server (which ignores it)
}

export const ModelVendorOpenAI: IModelVendor<DOpenAIServiceSettings, OpenAIAccessSchema> = {
  id: 'openai',
  name: 'OpenAI',
  displayRank: 10,
  displayGroup: 'popular',
  location: 'cloud',
  instanceLimit: 10,
  hasServerConfigKey: 'hasLlmOpenAI',

  /// client-side-fetch ///
  csfAvailable: _csfOpenAIAvailable,

  // functions
  getTransportAccess: (partialSetup): OpenAIAccessSchema => ({
    dialect: 'openai',
    clientSideFetch: _csfOpenAIAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.oaiKey || '',
    oaiOrg: partialSetup?.oaiOrg || '',
    oaiHost: partialSetup?.oaiHost || '',
    heliKey: partialSetup?.heliKey || '',
  }),

  // List Models
  rpcUpdateModelsOrThrow: async (access) => await apiAsync.llmOpenAI.listModels.query({ access }),

};

function _csfOpenAIAvailable(s?: Partial<DOpenAIServiceSettings>) {
  return !!(s?.oaiHost || s?.oaiKey);
}
