import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


export interface DMetaAIServiceSettings {
  metaaiKey: string;
  metaaiHost: string;
  csf?: boolean;
}

export const ModelVendorMetaAI: IModelVendor<DMetaAIServiceSettings, OpenAIAccessSchema> = {
  id: 'metaai',
  name: 'Meta AI',
  displayRank: 16,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,

  /// client-side-fetch ///
  // api.meta.ai answers preflights with access-control-allow-origin/headers '*' on /v1/responses and /v1/models (verified 2026-09-02)
  csfAvailable: _csfMetaAIAvailable,

  // functions
  initializeSetup: () => ({
    metaaiKey: '',
    metaaiHost: '',
  }),
  validateSetup: (setup) => {
    // served keys look like 'LLM_<digits>_<secret>' (48 chars); the docs print 'LLM|<digits>|<secret>' - accept both separators
    return !!setup.metaaiKey?.startsWith('LLM') && setup.metaaiKey.length >= 20;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'metaai',
    clientSideFetch: _csfMetaAIAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.metaaiKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.metaaiHost || '',
  }),

  // OpenAI transport ('metaai' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};

function _csfMetaAIAvailable(s?: Partial<DMetaAIServiceSettings>) {
  return !!s?.metaaiKey;
}
