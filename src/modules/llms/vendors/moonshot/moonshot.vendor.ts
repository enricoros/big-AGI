import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


interface DMoonshotServiceSettings {
  moonshotKey: string;
  csf?: boolean;
}

/** Kimi Code subscription keys ('sk-kimi-...') route to api.kimi.com/coding instead of api.moonshot.ai (server-side in openai.access.ts) */
export function isKimiCodeSubscriptionKey(key?: string): boolean {
  return !!key?.startsWith('sk-kimi-');
}

export const ModelVendorMoonshot: IModelVendor<DMoonshotServiceSettings, OpenAIAccessSchema> = {
  id: 'moonshot',
  name: 'Moonshot AI',
  displayRank: 34,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmMoonshot',

  /// client-side-fetch ///
  csfAvailable: _csfMoonshotAvailable,

  // functions
  initializeSetup: () => ({
    moonshotKey: '',
  }),
  validateSetup: (setup) => {
    return setup.moonshotKey?.length >= 20;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'moonshot',
    clientSideFetch: _csfMoonshotAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.moonshotKey || '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
  }),

  // OpenAI transport ('moonshot' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfMoonshotAvailable(s?: Partial<DMoonshotServiceSettings>) {
  // Kimi Code subscription keys route to api.kimi.com/coding, which has no CORS (preflight 404, probe-verified 2026-07-18)
  return !!s?.moonshotKey && !isKimiCodeSubscriptionKey(s.moonshotKey);
}
