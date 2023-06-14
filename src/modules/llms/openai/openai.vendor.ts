import { ModelVendor } from '../llm.types';
import { OpenAIIcon } from './OpenAIIcon';
import { OpenAILLMOptions } from './OpenAILLMOptions';
import { OpenAISourceSetup } from './OpenAISourceSetup';
import { callChat } from './openai.client';


export const ModelVendorOpenAI: ModelVendor = {
  id: 'openai',
  name: 'OpenAI',
  rank: 10,
  location: 'cloud',
  instanceLimit: 1,

  // components
  Icon: OpenAIIcon,
  SourceSetupComponent: OpenAISourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  callChat: callChat,
};


export interface SourceSetupOpenAI {
  oaiKey: string;
  oaiOrg: string;
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
  heliKey: string;  // helicone key (works in conjunction with oaiHost)
}

export function normalizeOAISetup(partialSetup?: Partial<SourceSetupOpenAI>): SourceSetupOpenAI {
  return {
    oaiKey: '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    ...partialSetup,
  };
}


export interface LLMOptionsOpenAI {
  llmRef: string;
  llmTemperature: number;
  llmResponseTokens: number;
}

export function normalizeOAIOptions(partialOptions?: Partial<LLMOptionsOpenAI>): LLMOptionsOpenAI {
  return {
    llmRef: 'unknown_id',
    llmTemperature: 0.5,
    llmResponseTokens: 1024,
    ...partialOptions,
  };
}