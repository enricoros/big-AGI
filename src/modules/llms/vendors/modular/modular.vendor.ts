import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


export interface DModularServiceSettings {
  mode?: 'cloud' | 'selfhosted'; // optional: pre-existing services default to 'cloud'
  modularKey: string;
  modularHost: string;
}

export const ModelVendorModular: IModelVendor<DModularServiceSettings, OpenAIAccessSchema> = {
  id: 'modular',
  name: 'Modular',
  displayRank: 36,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 2, // one Modular Cloud + one self-hosted MAX service

  // NOTE: no `csfAvailable` - api.modular.com does not allow browser-direct (CORS) requests, so this vendor is server-only

  // functions
  initializeSetup: () => ({
    mode: 'cloud',
    modularKey: '',
    modularHost: '',
  }),
  validateSetup: (setup) => {
    if ((setup?.mode ?? 'cloud') === 'selfhosted')
      return !!setup.modularHost;
    return setup.modularKey?.startsWith('sk-mod-') && setup.modularKey?.length >= 40;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'modular',
    clientSideFetch: false, // server-only (no CSF)
    oaiKey: partialSetup?.modularKey || '',
    oaiOrg: '',
    oaiHost: (partialSetup?.mode ?? 'cloud') === 'selfhosted' ? (partialSetup?.modularHost || '') : '', // cloud: empty, so the server default applies
  }),

  // OpenAI transport ('modular' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};
