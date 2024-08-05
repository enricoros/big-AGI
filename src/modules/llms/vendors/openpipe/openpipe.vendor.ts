import { OpenPipeIcon } from '~/common/components/icons/vendors/OpenPipeIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { OpenPipeSourceSetup } from './OpenPipeSourceSetup';


export interface SourceSetupOpenPipe {
  openPipeKey: string;
  openPipeTags: string; // hack: this will travel as 'oaiOrg' in the access schema - then interpreted in the openAIAccess() function
}

export const ModelVendorOpenPipe: IModelVendor<SourceSetupOpenPipe, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'openpipe',
  name: 'OpenPipe',
  rank: 16,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCapKey: 'hasLlmOpenPipe',

  // components
  Icon: OpenPipeIcon,
  SourceSetupComponent: OpenPipeSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initializeSetup: () => ({
    openPipeKey: '',
    openPipeTags: '',
  }),
  validateSetup: (setup) => {
    return setup.openPipeKey?.length >= 64;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'openpipe',
    oaiKey: partialSetup?.openPipeKey || '',
    oaiOrg: partialSetup?.openPipeTags || '', // HACK: use tags for org - should use type discrimination
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('openpipe' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,
  rpcChatGenerateOrThrow: ModelVendorOpenAI.rpcChatGenerateOrThrow,
  streamingChatGenerateOrThrow: ModelVendorOpenAI.streamingChatGenerateOrThrow,
};
