import DevicesIcon from '@mui/icons-material/Devices';

import { ModelVendor } from '../llm.types';

import { OpenAILLMOptions } from '~/modules/llms/openai/OpenAILLMOptions';
import { openAICallChat, openAICallChatWithFunctions } from '~/modules/llms/openai/openai.client';

import { LocalAISourceSetup } from './LocalAISourceSetup';


export const ModelVendorLocalAI: ModelVendor = {
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
  callChat: openAICallChat,
  callChatWithFunctions: openAICallChatWithFunctions,
};

export interface SourceSetupLocalAI {
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
}

export function normalizeLocalAISetup(partialSetup?: Partial<SourceSetupLocalAI>): SourceSetupLocalAI {
  return {
    oaiHost: '',
    ...partialSetup,
  };
}