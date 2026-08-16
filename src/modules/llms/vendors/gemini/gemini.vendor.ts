import { apiAsync } from '~/common/util/trpc.client';

import type { GeminiWire_Safety } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';

import type { GeminiAccessSchema } from '../../server/gemini/gemini.access';
import type { IModelVendor } from '../IModelVendor';


interface DGeminiServiceSettings {
  geminiKey: string;
  geminiHost: string;
  csf?: boolean;
  minSafetyLevel: GeminiWire_Safety.HarmBlockThreshold;
  /** Vertex AI / dynamic auth: bearer token (short-lived ADC or gateway token) */
  geminiBearerToken?: string;
  /** GCP project for Vertex path: /v1/projects/{id}/locations/... */
  vertexProjectId?: string;
  /** Vertex location (default us-central1) */
  vertexLocation?: string;
}


export const ModelVendorGemini: IModelVendor<DGeminiServiceSettings, GeminiAccessSchema> = {
  id: 'googleai',
  name: 'Gemini',
  displayRank: 14,
  displayGroup: 'popular',
  location: 'cloud',
  instanceLimit: 2,
  hasServerConfigKey: 'hasLlmGemini',

  /// client-side-fetch ///
  csfAvailable: _csfGeminiAvailable,

  // functions
  initializeSetup: () => ({
    geminiKey: '',
    geminiHost: '',
    geminiBearerToken: '',
    vertexProjectId: '',
    vertexLocation: '',
    minSafetyLevel: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
  }),
  validateSetup: (setup) => {
    // API key OR bearer token (Vertex / #1134) is sufficient
    return (setup.geminiKey?.length > 0) || (setup.geminiBearerToken?.length > 0);
  },
  getTransportAccess: (partialSetup): GeminiAccessSchema => ({
    dialect: 'gemini',
    clientSideFetch: _csfGeminiAvailable(partialSetup) && !!partialSetup?.csf,
    geminiKey: partialSetup?.geminiKey || '',
    geminiHost: partialSetup?.geminiHost || '',
    minSafetyLevel: partialSetup?.minSafetyLevel || 'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
    geminiBearerToken: partialSetup?.geminiBearerToken || '',
    vertexProjectId: partialSetup?.vertexProjectId || '',
    vertexLocation: partialSetup?.vertexLocation || '',
  }),

  // List Models
  rpcUpdateModelsOrThrow: async (access) => await apiAsync.llmGemini.listModels.query({ access }),

};

function _csfGeminiAvailable(s?: Partial<DGeminiServiceSettings>) {
  return !!(s?.geminiKey || s?.geminiBearerToken);
}
