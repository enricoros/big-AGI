import { LocalAIIcon } from '~/common/components/icons/vendors/LocalAIIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { ModelVendorOpenAI } from '../openai/openai.vendor';

import { LocalAIServiceSetup } from './LocalAIServiceSetup';


interface DLocalAIServiceSettings {
  localAIHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
  localAIKey: string;   // use OpenAI-compatible API keys
}

export const ModelVendorLocalAI: IModelVendor<DLocalAIServiceSettings, OpenAIAccessSchema> = {
  id: 'localai',
  name: 'LocalAI',
  displayRank: 50,
  location: 'local',
  instanceLimit: 4,
  hasBackendCapKey: 'hasLlmLocalAIHost',
  hasBackendCapFn: (backendCapabilities) => {
    // this is to show the green mark on the vendor icon in the setup screen
    return backendCapabilities.hasLlmLocalAIHost || backendCapabilities.hasLlmLocalAIKey;
  },

  // components
  Icon: LocalAIIcon,
  ServiceSetupComponent: LocalAIServiceSetup,

  // functions
  initializeSetup: () => ({
    localAIHost: '',
    localAIKey: '',
  }),
  getTransportAccess: (partialSetup) => ({
    dialect: 'localai',
    oaiKey: partialSetup?.localAIKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.localAIHost || '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('localai' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};
