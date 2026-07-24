import { apiAsync } from '~/common/util/trpc.client';

import type { AnthropicAccessSchema } from '../../server/anthropic/anthropic.access';
import type { IModelVendor } from '../IModelVendor';


// special symbols
export const isValidAnthropicApiKey = (apiKey?: string) => !!apiKey && (apiKey.startsWith('sk-') ? apiKey.length >= 39 : apiKey.length > 1);

interface DAnthropicServiceSettings {
  anthropicKey: string;
  anthropicHost: string;
  csf?: boolean;
  inferenceGeoUS?: boolean; // [Anthropic, 2026-02-01] restrict inference to US region
}

export const ModelVendorAnthropic: IModelVendor<DAnthropicServiceSettings, AnthropicAccessSchema> = {
  id: 'anthropic',
  name: 'Anthropic',
  displayRank: 12,
  displayGroup: 'popular',
  location: 'cloud',
  brandColor: '#cc785c',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmAnthropic',

  /// client-side-fetch ///
  csfAvailable: _csfAnthropicAvailable,

  // functions
  getTransportAccess: (partialSetup): AnthropicAccessSchema => ({
    dialect: 'anthropic',
    clientSideFetch: _csfAnthropicAvailable(partialSetup) && !!partialSetup?.csf,
    anthropicKey: partialSetup?.anthropicKey || '',
    // ignore leftover Helicone proxy hosts (integration removed 2026-07): substring is fine, as a false positive falls back to the official host
    anthropicHost: partialSetup?.anthropicHost?.includes('hconeai.com') ? null : partialSetup?.anthropicHost || null,
    anthropicInferenceGeo: partialSetup?.inferenceGeoUS ? 'us' : null,
  }),

  // List Models
  rpcUpdateModelsOrThrow: async (access) => await apiAsync.llmAnthropic.listModels.query({ access }),

};

function _csfAnthropicAvailable(s?: Partial<DAnthropicServiceSettings>) {
  return !!s?.anthropicKey;
}
