import { AzureIcon } from '~/common/components/icons/vendors/AzureIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';

import { AzureSourceSetup } from './AzureSourceSetup';


// special symbols
export const isValidAzureApiKey = (apiKey?: string) => !!apiKey && apiKey.length >= 32;

export interface SourceSetupAzure {
  azureEndpoint: string;
  azureKey: string;
}

/** Implementation Notes for the Azure Vendor
 *
 * Listing models for Azure OpenAI is complex. The "Azure OpenAI Model List" API lists every model that can
 * be deployed, including numerous models that are not accessible by the user. What the users want are the
 * "deployed" models.
 *
 *   1. To list those, there was an API available in the past, but it was removed. It was about hitting the
 *      "/openai/deployments?api-version=2023-03-15-preview" path on the endpoint. See:
 *      https://github.com/openai/openai-python/issues/447#issuecomment-1730976835
 *
 *   2. Still looking for a solution - in the meantime the way to go seems to be to manually get the full URL
 *      of every "Deployment" (Model) and hit the URL directly. However the user will need to fill in the full
 *      model sheet, as details are not available just from the URL.
 *
 * Work in progress...
 */
export const ModelVendorAzure: IModelVendor<SourceSetupAzure, OpenAIAccessSchema, LLMOptionsOpenAI> = {
  id: 'azure',
  name: 'Azure',
  rank: 14,
  location: 'cloud',
  instanceLimit: 2,
  hasBackendCapKey: 'hasLlmAzureOpenAI',

  // components
  Icon: AzureIcon,
  SourceSetupComponent: AzureSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  getTransportAccess: (partialSetup): OpenAIAccessSchema => ({
    dialect: 'azure',
    oaiKey: partialSetup?.azureKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.azureEndpoint || '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('azure' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,
  rpcChatGenerateOrThrow: ModelVendorOpenAI.rpcChatGenerateOrThrow,
  streamingChatGenerateOrThrow: ModelVendorOpenAI.streamingChatGenerateOrThrow,
};