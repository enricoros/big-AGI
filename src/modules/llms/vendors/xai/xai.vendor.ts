import { XAIIcon } from '~/common/components/icons/vendors/XAIIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { ModelVendorOpenAI } from '../openai/openai.vendor';

import { XAIServiceSetup } from './XAIServiceSetup';


export interface DXAIServiceSettings {
  xaiKey: string;
}

export const ModelVendorXAI: IModelVendor<DXAIServiceSettings, OpenAIAccessSchema> = {
  id: 'xai',
  name: 'xAI',
  displayRank: 15,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCapKey: 'hasLlmXAI',

  // Components
  Icon: XAIIcon,
  ServiceSetupComponent: XAIServiceSetup,

  // functions
  initializeSetup: () => ({ xaiKey: '' }),
  validateSetup: setup => setup.xaiKey?.length >= 80, // we assume all API keys are 80 chars+ - we won't have a strict validation
  getTransportAccess: (partialSetup) => ({
    dialect: 'xai',
    oaiKey: partialSetup?.xaiKey || '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('xai' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};
