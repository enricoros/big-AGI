import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { LMStudioSourceSetup } from './LMStudioSourceSetup';
import { LMStudioIcon } from '~/common/components/icons/vendors/LMStudioIcon';


export interface SourceSetupLMStudio {
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
}

export const ModelVendorLMStudio: IModelVendor<SourceSetupLMStudio, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'lmstudio',
  name: 'LM Studio',
  rank: 21,
  location: 'local',
  instanceLimit: 1,

  // components
  Icon: LMStudioIcon,
  SourceSetupComponent: LMStudioSourceSetup,
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
  rpcChatGenerateOrThrow: ModelVendorOpenAI.rpcChatGenerateOrThrow,
  streamingChatGenerateOrThrow: ModelVendorOpenAI.streamingChatGenerateOrThrow,
};
