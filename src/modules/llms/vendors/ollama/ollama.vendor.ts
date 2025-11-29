import { apiAsync } from '~/common/util/trpc.client';

import type { IModelVendor } from '../IModelVendor';
import type { OllamaAccessSchema } from '../../server/ollama/ollama.access';


interface DOllamaServiceSettings {
  ollamaHost: string;
  csf?: boolean;
}


export const ModelVendorOllama: IModelVendor<DOllamaServiceSettings, OllamaAccessSchema> = {
  id: 'ollama',
  name: 'Ollama',
  displayRank: 54,
  displayGroup: 'local',
  location: 'local',
  instanceLimit: 2,
  hasServerConfigKey: 'hasLlmOllama',

  /// client-side-fetch ///
  csfAvailable: _csfOllamaAvailable,

  // functions
  initializeSetup: () => ({
    ollamaHost: '',
    // csf: true, // eventually
  }),
  getTransportAccess: (partialSetup): OllamaAccessSchema => ({
    dialect: 'ollama',
    clientSideFetch: _csfOllamaAvailable(partialSetup) && !!partialSetup?.csf,
    ollamaHost: partialSetup?.ollamaHost || '',
  }),

  // List Models
  rpcUpdateModelsOrThrow: async (access) => await apiAsync.llmOllama.listModels.query({ access }),

};

function _csfOllamaAvailable(s?: Partial<DOllamaServiceSettings>) {
  return !!s?.ollamaHost;
}
