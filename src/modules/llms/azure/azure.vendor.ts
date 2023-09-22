import { apiAsync } from '~/modules/trpc/trpc.client';

import { DLLM, ModelVendor } from '../llm.types';
import { LLMOptionsOpenAI } from '../openai/openai.vendor';
import { OpenAILLMOptions } from '../openai/OpenAILLMOptions';
import { VChatFunctionIn, VChatMessageIn, VChatMessageOrFunctionCallOut, VChatMessageOut } from '../llm.client';

import { AzureIcon } from './AzureIcon';
import { AzureSourceSetup } from './AzureSourceSetup';


// special symbols
export const hasServerKeyAzure = !!process.env.HAS_SERVER_KEY_AZURE_OPENAI;
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
 *   2. Still looking for a solution - in the meantime the way to go seems to be to manyally get the full URL
 *      of every "Deployment" (Model) and hit the URL directly. However the user will need to fill in the full
 *      model sheet, as details are not available just from the URL.
 *
 * Work in progress...
 */
export const ModelVendorAzure: ModelVendor<SourceSetupAzure, LLMOptionsOpenAI> = {
  id: 'azure',
  name: 'Azure',
  rank: 14,
  location: 'cloud',
  instanceLimit: 2,

  // components
  Icon: AzureIcon,
  SourceSetupComponent: AzureSourceSetup,
  LLMOptionsComponent: OpenAILLMOptions,

  // functions
  normalizeSetup: (partialSetup?: Partial<SourceSetupAzure>): SourceSetupAzure => ({
    azureEndpoint: '',
    azureKey: '',
    ...partialSetup,
  }),
  callChat: (llm: DLLM<LLMOptionsOpenAI>, messages: VChatMessageIn[], maxTokens?: number) => {
    return azureCallChatOverloaded<VChatMessageOut>(llm, messages, null, maxTokens);
  },
  callChatWithFunctions: () => {
    throw new Error('Azure does not support functions');
  },
};


/**
 * This function either returns the LLM message, or function calls, or throws a descriptive error string
 */
async function azureCallChatOverloaded<TOut = VChatMessageOut | VChatMessageOrFunctionCallOut>(
  llm: DLLM<LLMOptionsOpenAI>, messages: VChatMessageIn[], functions: VChatFunctionIn[] | null, maxTokens?: number,
): Promise<TOut> {
  // access params (source)
  const azureSetup = ModelVendorAzure.normalizeSetup(llm._source.setup as Partial<SourceSetupAzure>);

  // model params (llm)
  const { llmRef, llmTemperature = 0.5, llmResponseTokens } = llm.options;

  try {
    return await apiAsync.llmAzure.chatGenerate.mutate({
      access: azureSetup,
      model: {
        id: llmRef!,
        temperature: llmTemperature,
        maxTokens: maxTokens || llmResponseTokens || 1024,
      },
      // functions: functions ?? undefined,
      history: messages,
    }) as TOut;
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'OpenAI Chat Fetch Error';
    console.error(`openAICallChat: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}