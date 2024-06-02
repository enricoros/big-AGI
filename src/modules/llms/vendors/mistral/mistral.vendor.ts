import { MistralIcon } from '~/common/components/icons/vendors/MistralIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { LLMOptionsOpenAI, ModelVendorOpenAI, SourceSetupOpenAI } from '../openai/openai.vendor';
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
  hasBackendCapKey: 'hasLlmMistral',

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

  // OpenAI transport ('mistral' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,
  rpcChatGenerateOrThrow: ModelVendorOpenAI.rpcChatGenerateOrThrow,
  streamingChatGenerateOrThrow: ModelVendorOpenAI.streamingChatGenerateOrThrow,
};