import { OobaboogaIcon } from '~/common/components/icons/OobaboogaIcon';

import { IModelVendor } from '../IModelVendor';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { OobaboogaSourceSetup } from './OobaboogaSourceSetup';


export interface SourceSetupOobabooga {
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
}

export const ModelVendorOoobabooga: IModelVendor<SourceSetupOobabooga, LLMOptionsOpenAI> = {
  id: 'oobabooga',
  name: 'Oobabooga',
  rank: 15,
  location: 'local',
  instanceLimit: 1,

  // components
  Icon: OobaboogaIcon,
  SourceSetupComponent: OobaboogaSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initializeSetup: () => ({
    oaiHost: 'http://127.0.0.1:5001',
  }),
  normalizeSetup: (partialSetup?: Partial<SourceSetupOobabooga>) => ({
    oaiHost: '',
    ...partialSetup,
  }),
  callChat: ModelVendorOpenAI.callChat,
  callChatWithFunctions: ModelVendorOpenAI.callChatWithFunctions,
};