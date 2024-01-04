import DevicesIcon from '@mui/icons-material/Devices';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { LocalAISourceSetup } from './LocalAISourceSetup';


export interface SourceSetupLocalAI {
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
}

export const ModelVendorLocalAI: IModelVendor<SourceSetupLocalAI, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'localai',
  name: 'LocalAI',
  rank: 22,
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
  getTransportAccess: (partialSetup) => ({
    dialect: 'localai',
    oaiKey: '',
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
