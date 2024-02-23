import { LocalAIIcon } from '~/common/components/icons/vendors/LocalAIIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { LocalAISourceSetup } from './LocalAISourceSetup';
import { backendCaps } from '~/modules/backend/state-backend';


export interface SourceSetupLocalAI {
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
  oaiKey: string;   // use OpenAI-compatible API keys
}

export const ModelVendorLocalAI: IModelVendor<SourceSetupLocalAI, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'localai',
  name: 'LocalAI',
  rank: 22,
  location: 'local',
  instanceLimit: 4,
  hasBackendCap: () => backendCaps().hasLlmLocalAI,

  // components
  Icon: LocalAIIcon,
  SourceSetupComponent: LocalAISourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  initializeSetup: () => ({
    oaiHost: 'http://127.0.0.1:8080',
    oaiKey: '',
  }),
  getTransportAccess: (partialSetup) => ({
    dialect: 'localai',
    oaiKey: partialSetup?.oaiKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.oaiHost || '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('localai' dialect in 'access')
  rpcUpdateModelsQuery: ModelVendorOpenAI.rpcUpdateModelsQuery,
  rpcChatGenerateOrThrow: ModelVendorOpenAI.rpcChatGenerateOrThrow,
  streamingChatGenerateOrThrow: ModelVendorOpenAI.streamingChatGenerateOrThrow,
};
