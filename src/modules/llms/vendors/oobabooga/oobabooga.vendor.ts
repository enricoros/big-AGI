import { OobaboogaIcon } from '~/common/components/icons/OobaboogaIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../transports/server/openai/openai.router';
import type { VChatFunctionIn, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from '../../transports/chatGenerate';

import { LLMOptionsOpenAI, openAICallChatGenerate } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { OobaboogaSourceSetup } from './OobaboogaSourceSetup';


export interface SourceSetupOobabooga {
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
}

export const ModelVendorOoobabooga: IModelVendor<SourceSetupOobabooga, LLMOptionsOpenAI, OpenAIAccessSchema> = {
  id: 'oobabooga',
  name: 'Oobabooga',
  rank: 25,
  location: 'local',
  instanceLimit: 1,

  // components
  Icon: OobaboogaIcon,
  SourceSetupComponent: OobaboogaSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initializeSetup: (): SourceSetupOobabooga => ({
    oaiHost: 'http://127.0.0.1:5000',
  }),
  getAccess: (partialSetup): OpenAIAccessSchema => ({
    dialect: 'oobabooga',
    oaiKey: '',
    oaiOrg: '',
    oaiHost: partialSetup?.oaiHost || '',
    heliKey: '',
    moderationCheck: false,
  }),
  callChatGenerate(llm, messages: VChatMessageIn[], maxTokens?: number): Promise<VChatMessageOut> {
    return openAICallChatGenerate(this.getAccess(llm._source.setup), llm.options, messages, null, null, maxTokens);
  },
  callChatGenerateWF(llm, messages: VChatMessageIn[], functions: VChatFunctionIn[] | null, forceFunctionName: string | null, maxTokens?: number): Promise<VChatMessageOrFunctionCallOut> {
    return openAICallChatGenerate(this.getAccess(llm._source.setup), llm.options, messages, functions, forceFunctionName, maxTokens);
  },
};