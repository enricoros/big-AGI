import { AzureIcon } from '~/common/components/icons/AzureIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../transports/server/openai.router';
import type { VChatFunctionIn, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from '../../transports/chatGenerate';

import { LLMOptionsOpenAI, openAICallChatGenerate } from '../openai/openai.vendor';
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
export const ModelVendorAzure: IModelVendor<SourceSetupAzure, LLMOptionsOpenAI, OpenAIAccessSchema> = {
  id: 'azure',
  name: 'Azure',
  rank: 14,
  location: 'cloud',
  instanceLimit: 2,
  hasServerKey: !!process.env.HAS_SERVER_KEY_AZURE_OPENAI,

  // components
  Icon: AzureIcon,
  SourceSetupComponent: AzureSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  getAccess: (partialSetup): OpenAIAccessSchema => ({
    dialect: 'azure',
    oaiKey: partialSetup?.azureKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.azureEndpoint || '',
    heliKey: '',
    moderationCheck: false,
  }),
  callChatGenerate(llm, messages: VChatMessageIn[], maxTokens?: number): Promise<VChatMessageOut> {
    return openAICallChatGenerate(this.getAccess(llm._source.setup), llm.options, messages, null, null, maxTokens);
  },
  callChatGenerateWF(llm, messages: VChatMessageIn[], functions: VChatFunctionIn[] | null, forceFunctionName: string | null, maxTokens?: number): Promise<VChatMessageOrFunctionCallOut> {
    return openAICallChatGenerate(this.getAccess(llm._source.setup), llm.options, messages, functions, forceFunctionName, maxTokens);
  },
};