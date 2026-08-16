import { apiAsync } from '~/common/util/trpc.client';

import type { GeminiWire_Safety } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';

import type { GeminiAccessSchema } from '../../server/gemini/gemini.access';
import type { IModelVendor } from '../IModelVendor';


/**
 * Vertex AI / GCP Gemini — separate vendor from Developer API Gemini (issue #1134 Option A).
 * Reuses Gemini wire protocol + list/generate dispatch via dialect `gemini`, but owns:
 * - Bearer token auth (not API key)
 * - project / location path construction
 * - default host aiplatform.googleapis.com
 */
export interface DVertexAIServiceSettings {
  /** Short-lived ADC or gateway bearer token */
  vertexBearerToken: string;
  /** GCP project id */
  vertexProjectId: string;
  /** e.g. us-central1 or global */
  vertexLocation: string;
  /** Optional override (enterprise gateway / proxy) */
  vertexHost: string;
  minSafetyLevel: GeminiWire_Safety.HarmBlockThreshold;
  csf?: boolean;
}

export const isValidVertexBearerToken = (key?: string) => !!key && key.length >= 20;
export const isValidVertexProjectId = (id?: string) => !!id && id.length >= 2;


export const ModelVendorVertexAI: IModelVendor<DVertexAIServiceSettings, GeminiAccessSchema> = {
  id: 'vertexai',
  name: 'Gemini (Vertex AI)',
  displayRank: 15,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 2,
  hasServerConfigKey: 'hasLlmVertexAI',

  csfAvailable: _csfVertexAvailable,

  initializeSetup: () => ({
    vertexBearerToken: '',
    vertexProjectId: '',
    vertexLocation: 'us-central1',
    vertexHost: '',
    minSafetyLevel: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
  }),

  validateSetup: (setup) => {
    return isValidVertexBearerToken(setup.vertexBearerToken) && isValidVertexProjectId(setup.vertexProjectId);
  },

  getTransportAccess: (partialSetup): GeminiAccessSchema => ({
    dialect: 'gemini',
    clientSideFetch: _csfVertexAvailable(partialSetup) && !!partialSetup?.csf,
    // Vertex vendor does not use Developer API keys
    geminiKey: '',
    geminiHost: partialSetup?.vertexHost || '',
    minSafetyLevel: partialSetup?.minSafetyLevel || 'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
    geminiBearerToken: partialSetup?.vertexBearerToken || '',
    vertexProjectId: partialSetup?.vertexProjectId || '',
    vertexLocation: partialSetup?.vertexLocation || 'us-central1',
  }),

  rpcUpdateModelsOrThrow: async (access) => await apiAsync.llmGemini.listModels.query({ access }),
};

function _csfVertexAvailable(s?: Partial<DVertexAIServiceSettings>) {
  return isValidVertexBearerToken(s?.vertexBearerToken);
}
