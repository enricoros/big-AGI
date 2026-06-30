import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


interface DCerebrasServiceSettings {
  cerebrasKey: string;
  csf?: boolean;
}

export const ModelVendorCerebras: IModelVendor<DCerebrasServiceSettings, OpenAIAccessSchema> = {
  id: 'cerebras',
  name: 'Cerebras',
  displayRank: 33,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmCerebras',

  /// client-side-fetch ///
  csfAvailable: _csfCerebrasAvailable,

  // functions
  initializeSetup: () => ({
    cerebrasKey: '',
    // default Direct Connection ON: api.cerebras.ai is behind Cloudflare bot-management, which serves
    // the big-AGI server a 403 challenge page; the browser (CSF) passes cleanly. Auto-disabled when
    // there's no client-side key (see _csfCerebrasAvailable), so server-key deployments are unaffected.
    csf: true,
  }),
  validateSetup: (setup) => {
    return setup.cerebrasKey?.length >= 40;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'cerebras',
    clientSideFetch: _csfCerebrasAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.cerebrasKey || '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
  }),

  // OpenAI transport ('cerebras' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfCerebrasAvailable(s?: Partial<DCerebrasServiceSettings>) {
  return !!s?.cerebrasKey;
}
