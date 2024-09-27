import { DeepseekIcon } from '~/common/components/icons/vendors/DeepseekIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { DOpenAILLMOptions, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { DeepseekAIServiceSetup } from './DeepseekAIServiceSetup';


export interface DDeepseekServiceSettings {
  deepseekKey: string;
}

export const ModelVendorDeepseek: IModelVendor<DDeepseekServiceSettings, OpenAIAccessSchema, DOpenAILLMOptions> = {
  id: 'deepseek',
  name: 'Deepseek',
  rank: 19,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCapKey: 'hasLlmDeepseek',

  // components
  Icon: DeepseekIcon,
  ServiceSetupComponent: DeepseekAIServiceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initializeSetup: () => ({
    deepseekKey: '',
  }),
  validateSetup: (setup) => {
    return setup.deepseekKey?.length >= 35;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'deepseek',
    oaiKey: partialSetup?.deepseekKey || '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('Deepseek' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};
