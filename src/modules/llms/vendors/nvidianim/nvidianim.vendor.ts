import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


export interface DNvidiaNIMServiceSettings {
  nvidiaKey: string;
  nvidiaHost: string;
  csf?: boolean;
}

export const ModelVendorNvidiaNIM: IModelVendor<DNvidiaNIMServiceSettings, OpenAIAccessSchema> = {
  id: 'nvidianim',
  name: 'NVIDIA NIM',
  displayRank: 33,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,
  hasFreeModels: true, // the hosted build.nvidia.com endpoint is free (rate-limited, ~40 RPM per account)
  hasServerConfigKey: 'hasLlmNvidiaNIM',

  // CSF: the hosted endpoint CORS-allowlists *.nvidia.com only, so browser-direct is impossible against the
  // default host - CSF is only available when the user overrides the host (e.g. a local NIM/vLLM with open CORS)
  csfAvailable: _csfNvidiaNIMAvailable,

  // functions
  initializeSetup: () => ({
    nvidiaKey: '',
    nvidiaHost: '',
  }),
  validateSetup: (setup) => {
    // an 'nvapi-' key is required for the hosted endpoint; a custom (e.g. local NIM/vLLM) host may run keyless
    return setup.nvidiaKey?.startsWith('nvapi-') || !!setup.nvidiaHost;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'nvidianim',
    clientSideFetch: _csfNvidiaNIMAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.nvidiaKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.nvidiaHost || '',
  }),

  // the hosted endpoint is account-limited to ~40 requests/minute - space calls to avoid instant 429s
  // (e.g. Beam scatter); only applies to the default host, custom (local) hosts are unthrottled
  rateLimitChatGenerate: async (_llm, setup) => {
    if (setup?.nvidiaHost) return;
    const now = Date.now();
    const elapsed = now - _nextGenerationTs;
    const wait = 1600; /* 40 RPM = 1 req / 1.5s, plus some safety margin */
    if (elapsed < wait) {
      const delay = wait - elapsed;
      _nextGenerationTs = now + delay;
      await new Promise(resolve => setTimeout(resolve, delay));
    } else {
      _nextGenerationTs = now;
    }
  },

  // OpenAI transport ('nvidianim' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

// rate limit timestamp
let _nextGenerationTs = 0;

function _csfNvidiaNIMAvailable(s?: Partial<DNvidiaNIMServiceSettings>) {
  // only on a custom host - the default integrate.api.nvidia.com blocks cross-origin browser requests
  return !!s?.nvidiaHost;
}
