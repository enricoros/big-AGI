import { ModelVendor } from '../llm.types';

import { OpenAILLMOptions } from '~/modules/llms/openai/OpenAILLMOptions';
import { openAICallChat, openAICallChatWithFunctions } from '~/modules/llms/openai/openai.client';

import { OobaboogaIcon } from './OobaboogaIcon';
import { OobaboogaSourceSetup } from './OobaboogaSourceSetup';


export const ModelVendorOoobabooga: ModelVendor = {
  id: 'oobabooga',
  name: 'Oobabooga (Alpha)',
  rank: 15,
  location: 'local',
  instanceLimit: 1,

  // components
  Icon: OobaboogaIcon,
  SourceSetupComponent: OobaboogaSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  callChat: openAICallChat,
  callChatWithFunctions: openAICallChatWithFunctions,
};

export interface SourceSetupOobabooga {
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
}

export function normalizeOobaboogaSetup(partialSetup?: Partial<SourceSetupOobabooga>): SourceSetupOobabooga {
  return {
    oaiHost: '',
    ...partialSetup,
  };
}