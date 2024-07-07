import { DeepseekIcon } from '~/common/components/icons/vendors/DeepseekIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { DeepseekAISourceSetup } from './DeepseekAISourceSetup';


export interface SourceSetupDeepseek {
  deepseekKey: string;
}

export const ModelVendorDeepseek: IModelVendor<SourceSetupDeepseek, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'deepseek',
  name: 'Deepseek',
  rank: 19,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCapKey: 'hasLlmDeepseek',

  // components
  Icon: DeepseekIcon,
  SourceSetupComponent: DeepseekAISourceSetup,
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
  rpcChatGenerateOrThrow: ModelVendorOpenAI.rpcChatGenerateOrThrow,
  streamingChatGenerateOrThrow: ModelVendorOpenAI.streamingChatGenerateOrThrow,
};
