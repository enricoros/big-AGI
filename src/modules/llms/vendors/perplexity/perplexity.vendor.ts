import { PerplexityIcon } from '~/common/components/icons/vendors/PerplexityIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { PerplexitySourceSetup } from './PerplexitySourceSetup';


export interface SourceSetupPerplexity {
  perplexityKey: string;
}

export const ModelVendorPerplexity: IModelVendor<SourceSetupPerplexity, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'perplexity',
  name: 'Perplexity',
  rank: 18,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCapKey: 'hasLlmPerplexity',

  // components
  Icon: PerplexityIcon,
  SourceSetupComponent: PerplexitySourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initializeSetup: () => ({
    perplexityKey: '',
  }),
  validateSetup: (setup) => {
    return setup.perplexityKey?.length >= 50;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'perplexity',
    oaiKey: partialSetup?.perplexityKey || '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('perplexity' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,
  rpcChatGenerateOrThrow: ModelVendorOpenAI.rpcChatGenerateOrThrow,
  streamingChatGenerateOrThrow: ModelVendorOpenAI.streamingChatGenerateOrThrow,
};
