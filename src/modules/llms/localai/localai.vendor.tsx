import DevicesIcon from '@mui/icons-material/Devices';

import { ModelVendor } from '../llm.types';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { LocalAISourceSetup } from './LocalAISourceSetup';


export interface SourceSetupLocalAI {
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
}

export const ModelVendorLocalAI: ModelVendor<SourceSetupLocalAI, LLMOptionsOpenAI> = {
  id: 'localai',
  name: 'LocalAI',
  rank: 20,
  location: 'local',
  instanceLimit: 1,

  // components
  Icon: DevicesIcon,
  SourceSetupComponent: LocalAISourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initializeSetup: () => ({
    oaiHost: 'http://localhost:8080',
  }),
  normalizeSetup: (partialSetup?: Partial<SourceSetupLocalAI>) => ({
    oaiHost: '',
    ...partialSetup,
  }),
  callChat: ModelVendorOpenAI.callChat,
  callChatWithFunctions: ModelVendorOpenAI.callChatWithFunctions,
};