import { apiAsync } from '~/common/util/trpc.client';

import type { BedrockAccessSchema } from '../../server/bedrock/bedrock.access';
import type { IModelVendor } from '../IModelVendor';


// validation
export const isValidBedrockAccessKeyId = (key?: string) => !!key && key.length >= 16;
export const isValidBedrockSecretAccessKey = (key?: string) => !!key && key.length >= 16;

export interface DBedrockServiceSettings {
  bedrockAccessKeyId: string;
  bedrockSecretAccessKey: string;
  bedrockSessionToken: string;
  bedrockRegion: string;
  csf?: boolean;
}

export const ModelVendorBedrock: IModelVendor<DBedrockServiceSettings, BedrockAccessSchema> = {
  id: 'bedrock',
  name: 'AWS Bedrock',
  displayRank: 14,
  displayGroup: 'cloud',
  location: 'cloud',
  brandColor: '#FF9900', // AWS orange
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmBedrock',

  // NOTE: CSF not supported: Bedrock has no CORS headers
  csfAvailable: _csfBedrockAvailable,

  // functions
  initializeSetup: () => ({
    bedrockAccessKeyId: '',
    bedrockSecretAccessKey: '',
    bedrockSessionToken: '',
    bedrockRegion: 'us-west-2',
    csf: false,
  }),

  getTransportAccess: (partialSetup): BedrockAccessSchema => ({
    dialect: 'bedrock',
    bedrockAccessKeyId: partialSetup?.bedrockAccessKeyId || '',
    bedrockSecretAccessKey: partialSetup?.bedrockSecretAccessKey || '',
    bedrockSessionToken: partialSetup?.bedrockSessionToken || null,
    bedrockRegion: partialSetup?.bedrockRegion || 'us-west-2',
    clientSideFetch: _csfBedrockAvailable(partialSetup) && !!partialSetup?.csf,
  }),

  // List Models
  rpcUpdateModelsOrThrow: async (access) => await apiAsync.llmBedrock.listModels.query({ access }),

};

function _csfBedrockAvailable(s?: Partial<DBedrockServiceSettings>) {
  return !!s?.bedrockAccessKeyId && !!s?.bedrockSecretAccessKey;
}
