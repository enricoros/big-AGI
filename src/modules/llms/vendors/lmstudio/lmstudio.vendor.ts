import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { DOpenAILLMOptions, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { LMStudioServiceSetup } from './LMStudioServiceSetup';
import { LMStudioIcon } from '~/common/components/icons/vendors/LMStudioIcon';


interface DLMStudioServiceSettings {
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
}

export const ModelVendorLMStudio: IModelVendor<DLMStudioServiceSettings, OpenAIAccessSchema, DOpenAILLMOptions> = {
  id: 'lmstudio',
  name: 'LM Studio',
  displayRank: 52,
  location: 'local',
  instanceLimit: 1,

  // components
  Icon: LMStudioIcon,
  ServiceSetupComponent: LMStudioServiceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initializeSetup: () => ({
    oaiHost: 'http://localhost:1234',
  }),
  getTransportAccess: (partialSetup) => ({
    dialect: 'lmstudio',
    oaiKey: '',
    oaiOrg: '',
    oaiHost: partialSetup?.oaiHost || '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('lmstudio' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};
