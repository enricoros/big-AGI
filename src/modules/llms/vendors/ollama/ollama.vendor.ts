import { apiAsync } from '~/common/util/trpc.client';

import type { IModelVendor } from '../IModelVendor';
import type { OllamaAccessSchema } from '../../server/ollama/ollama.router';


interface DOllamaServiceSettings {
  ollamaHost: string;
  ollamaJson: boolean;
}


export const ModelVendorOllama: IModelVendor<DOllamaServiceSettings, OllamaAccessSchema> = {
  id: 'ollama',
  name: 'Ollama',
  displayRank: 54,
  displayGroup: 'local',
  location: 'local',
  instanceLimit: 2,
  hasServerConfigKey: 'hasLlmOllama',

  // functions
  getTransportAccess: (partialSetup): OllamaAccessSchema => ({
    dialect: 'ollama',
    ollamaHost: partialSetup?.ollamaHost || '',
    ollamaJson: partialSetup?.ollamaJson || false,
  }),

  // List Models
  rpcUpdateModelsOrThrow: async (access) => await apiAsync.llmOllama.listModels.query({ access }),

};
