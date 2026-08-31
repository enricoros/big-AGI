import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


interface DLlmmanServiceSettings {
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
  csf?: boolean;
}

export const ModelVendorLlmman: IModelVendor<DLlmmanServiceSettings, OpenAIAccessSchema> = {
  id: 'llmman',
  name: 'llmman',
  displayRank: 53,
  displayGroup: 'local',
  location: 'local',
  instanceLimit: 1,

  /// client-side-fetch ///
  csfAvailable: _csfLlmmanAvailable,

  // functions
  initializeSetup: () => ({
    oaiHost: 'http://localhost:17434',
  }),
  getTransportAccess: (partialSetup) => ({
    dialect: 'llmman',
    clientSideFetch: _csfLlmmanAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: '',
    oaiOrg: '',
    oaiHost: partialSetup?.oaiHost || '',
  }),

  // OpenAI transport ('llmman' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfLlmmanAvailable(_s?: Partial<DLlmmanServiceSettings>) {
  // always available for local vendors - LM Studio defaults to http://localhost:17434
  // was: return !!s?.oaiHost;
  return true;
}
