import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


export interface DLocalAIServiceSettings {
  localAIHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
  localAIKey: string;   // use OpenAI-compatible API keys
  csf?: boolean;
}

export const ModelVendorLocalAI: IModelVendor<DLocalAIServiceSettings, OpenAIAccessSchema> = {
  id: 'localai',
  name: 'LocalAI',
  displayRank: 50,
  displayGroup: 'local',
  location: 'local',
  instanceLimit: 4,
  hasServerConfigKey: 'hasLlmLocalAIHost',
  hasServerConfigFn: (backendCapabilities) => {
    // this is to show the green mark on the vendor icon in the setup screen
    return backendCapabilities.hasLlmLocalAIHost || backendCapabilities.hasLlmLocalAIKey;
  },

  /// client-side-fetch ///
  csfAvailable: _csfLocalAIAvailable,

  // functions
  initializeSetup: () => ({
    localAIHost: '',
    localAIKey: '',
    // csf: true, // eventually, but requires CORS support on the server: -e CORS=true -e CORS_ALLOW_ORIGINS="*"
  }),
  getTransportAccess: (partialSetup) => ({
    dialect: 'localai',
    clientSideFetch: _csfLocalAIAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.localAIKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.localAIHost || '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('localai' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfLocalAIAvailable(s?: Partial<DLocalAIServiceSettings>) {
  return !!s?.localAIHost;
}
