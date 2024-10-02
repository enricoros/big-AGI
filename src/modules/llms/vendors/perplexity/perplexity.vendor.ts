import { PerplexityIcon } from '~/common/components/icons/vendors/PerplexityIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { DOpenAILLMOptions, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { PerplexityServiceSetup } from './PerplexityServiceSetup';


interface DPerpexityServiceSettings {
  perplexityKey: string;
}

export const ModelVendorPerplexity: IModelVendor<DPerpexityServiceSettings, OpenAIAccessSchema, DOpenAILLMOptions> = {
  id: 'perplexity',
  name: 'Perplexity',
  displayRank: 20,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCapKey: 'hasLlmPerplexity',

  // components
  Icon: PerplexityIcon,
  ServiceSetupComponent: PerplexityServiceSetup,
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

};
