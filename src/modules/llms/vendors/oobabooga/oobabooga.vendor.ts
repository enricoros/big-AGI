import { OobaboogaIcon } from '~/common/components/icons/vendors/OobaboogaIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { OobaboogaSourceSetup } from './OobaboogaSourceSetup';


export interface SourceSetupOobabooga {
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
}

export const ModelVendorOoobabooga: IModelVendor<SourceSetupOobabooga, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'oobabooga',
  name: 'Oobabooga',
  rank: 23,
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
  getTransportAccess: (partialSetup): OpenAIAccessSchema => ({
    dialect: 'oobabooga',
    oaiKey: '',
    oaiOrg: '',
    oaiHost: partialSetup?.oaiHost || '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport (oobabooga dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,
  rpcChatGenerateOrThrow: ModelVendorOpenAI.rpcChatGenerateOrThrow,
  streamingChatGenerateOrThrow: ModelVendorOpenAI.streamingChatGenerateOrThrow,
};