import { backendCaps } from '~/modules/backend/state-backend';

import { MistralIcon } from '~/common/components/icons/MistralIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../transports/server/openai/openai.router';
import type { VChatMessageIn, VChatMessageOut } from '../../transports/chatGenerate';

import { LLMOptionsOpenAI, openAICallChatGenerate, SourceSetupOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { MistralSourceSetup } from './MistralSourceSetup';


// special symbols

export type SourceSetupMistral = Pick<SourceSetupOpenAI, 'oaiKey' | 'oaiHost'>;


/** Implementation Notes for the Mistral vendor
 */
export const ModelVendorMistral: IModelVendor<SourceSetupMistral, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'mistral',
  name: 'Mistral',
  rank: 15,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCap: () => backendCaps().hasLlmMistral,

  // components
  Icon: MistralIcon,
  SourceSetupComponent: MistralSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initializeSetup: () => ({
    oaiHost: 'https://api.mistral.ai/',
    oaiKey: '',
  }),
  validateSetup: (setup) => {
    return setup.oaiKey?.length >= 32;
  },
  getTransportAccess: (partialSetup): OpenAIAccessSchema => ({
    dialect: 'mistral',
    oaiKey: partialSetup?.oaiKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.oaiHost || '',
    heliKey: '',
    moderationCheck: false,
  }),
  callChatGenerate(llm, messages: VChatMessageIn[], maxTokens?: number): Promise<VChatMessageOut> {
    return openAICallChatGenerate(this.getTransportAccess(llm._source.setup), llm.options, messages, null, null, maxTokens);
  },
  callChatGenerateWF() {
    throw new Error('Mistral does not support "Functions" yet');
  },
};