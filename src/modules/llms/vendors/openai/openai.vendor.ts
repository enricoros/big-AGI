import { OpenAIIcon } from '~/common/components/icons/vendors/OpenAIIcon';
import { apiAsync } from '~/common/util/trpc.client';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { OpenAILLMOptions } from './OpenAILLMOptions';
import { OpenAIServiceSetup } from './OpenAIServiceSetup';


// shared constants
export const FALLBACK_LLM_RESPONSE_TOKENS = 1024;
export const FALLBACK_LLM_TEMPERATURE = 0.5;


// special symbols
// export const isValidOpenAIApiKey = (apiKey?: string) => !!apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;

export interface DOpenAIServiceSettings {
  oaiKey: string;
  oaiOrg: string;
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
  heliKey: string;  // helicone key (works in conjunction with oaiHost)
  moderationCheck: boolean;
}

export interface DOpenAILLMOptions {
  llmRef: string;
  llmTemperature: number;
  llmResponseTokens: number | null;
}

export const ModelVendorOpenAI: IModelVendor<DOpenAIServiceSettings, OpenAIAccessSchema, DOpenAILLMOptions> = {
  id: 'openai',
  name: 'OpenAI',
  displayRank: 10,
  location: 'cloud',
  instanceLimit: 5,
  hasBackendCapKey: 'hasLlmOpenAI',

  // components
  Icon: OpenAIIcon,
  ServiceSetupComponent: OpenAIServiceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  getTransportAccess: (partialSetup): OpenAIAccessSchema => ({
    dialect: 'openai',
    oaiKey: '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
    ...partialSetup,
  }),

  // List Models
  rpcUpdateModelsOrThrow: async (access) => await apiAsync.llmOpenAI.listModels.query({ access }),

};
