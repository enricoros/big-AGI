import { AnthropicIcon } from '~/common/components/icons/vendors/AnthropicIcon';
import { apiAsync } from '~/common/util/trpc.client';

import type { AnthropicAccessSchema } from '../../server/anthropic/anthropic.router';
import type { IModelVendor } from '../IModelVendor';

import { AnthropicServiceSetup } from './AnthropicServiceSetup';


// special symbols
export const isValidAnthropicApiKey = (apiKey?: string) => !!apiKey && (apiKey.startsWith('sk-') ? apiKey.length >= 39 : apiKey.length > 1);

interface DAnthropicServiceSettings {
  anthropicKey: string;
  anthropicHost: string;
  heliconeKey: string;
}

export const ModelVendorAnthropic: IModelVendor<DAnthropicServiceSettings, AnthropicAccessSchema> = {
  id: 'anthropic',
  name: 'Anthropic',
  displayRank: 12,
  location: 'cloud',
  brandColor: '#cc785c',
  instanceLimit: 1,
  hasBackendCapKey: 'hasLlmAnthropic',

  // components
  Icon: AnthropicIcon,
  ServiceSetupComponent: AnthropicServiceSetup,

  // functions
  getTransportAccess: (partialSetup): AnthropicAccessSchema => ({
    dialect: 'anthropic',
    anthropicKey: partialSetup?.anthropicKey || '',
    anthropicHost: partialSetup?.anthropicHost || null,
    heliconeKey: partialSetup?.heliconeKey || null,
  }),


  // List Models
  rpcUpdateModelsOrThrow: async (access) => await apiAsync.llmAnthropic.listModels.query({ access }),

};
