import * as z from 'zod/v4';

// import { LLM_IF_HOTFIX_NoTemperature, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { LLM_IF_OAI_Chat } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from './models.data';
import { _knownOpenAIChatModels } from './openai.models';


// [Azure]
const _knownAzureChatModels: ManualMappings = [
  // ... if you have your own models, map them here ...
  //
  // NOTE: the ManualMapping object is similar to ModelDescriptionSchema,
  // with a renamed id field and other flags (isPreview, isLegacy, etc.), only used for
  // a consistent labeling of the model when fromManualMapping is invoked.
  //
  // Example:
  // {
  //   idPrefix: 'my-deployment-name',
  //   label: 'This is THE Model (25.12)',
  //   description: 'Top-tier reasoning.',
  //   contextWindow: 200 * 1024, // 200K tokens
  //   maxCompletionTokens: 8192, // 8K tokens
  //   interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Json, LLM_IF_OAI_Fn, /* <- flags | fixes -> */ LLM_IF_HOTFIX_NoTemperature],
  //   chatPrice: { input: 2, output: 6 },
  // },
  //

  // [Azure] variants: Azure names these differently compared to OpenAI (no dots) - also: obsolete
  {
    idPrefix: 'gpt-35-turbo-16k',
    label: '3.5-Turbo 16k',
    hidden: true, // OLD
    description: 'Fair speed and smarts, large context',
    contextWindow: 16384,
    interfaces: [LLM_IF_OAI_Chat], // as azure doesn't version model id's (in the deployments), let's assume no function calling
  },
  {
    idPrefix: 'gpt-35-turbo',
    label: '3.5-Turbo',
    contextWindow: 4096,
    hidden: true, // OLD
    description: 'Fair speed and smarts',
    interfaces: [LLM_IF_OAI_Chat], // as azure doesn't version model id's (in the deployments), let's assume no function calling
  },

];


// parser for Azure models - 2025-03-14: verified
const _azureOpenAIDeployment_schema = z.object({
  object: z.literal('deployment'),
  model: z.string(), // the OpenAI model id
  owner: z.string(), // relaxed from z.enum(['organization-owner']) for #774
  id: z.string(), // the deployment name
  status: z.string(), // relaxed from z.enum(['succeeded']) for #744
  // scale_settings: z.object({ ... }), // unused
  created_at: z.number(),
  updated_at: z.number(),
});
type AzureOpenAIDeployment = z.infer<typeof _azureOpenAIDeployment_schema>;

const _azureOpenAIDeploymentsList_schema = z.object({
  object: z.literal('list'),
  data: z.array(_azureOpenAIDeployment_schema),
});


export function azureParseFromDeploymentsAPI(deploymentsApiResponse: object): AzureOpenAIDeployment[] {
  return _azureOpenAIDeploymentsList_schema.parse(deploymentsApiResponse).data;
}


const _azureDenyListPrefix = [
  // unsupported for chat: text embedding models
  'text-embedding-',
];

export function azureDeploymentFilter({ id }: AzureOpenAIDeployment) {
  // filter out models that are not chat models
  return !_azureDenyListPrefix.some(prefix => id.startsWith(prefix));
}


export function azureDeploymentToModelDescription(deployment: AzureOpenAIDeployment): ModelDescriptionSchema {
  const {
    id: deploymentName, // the model ID to invoke on Azure (set by the user during deployment, 'name')
    model: likelyTheOpenAIModel, // the base model that should map to OpenAI
    created_at: modelCreated,
    updated_at: modelUpdated = undefined,
  } = deployment;

  // MAPPING of Deployment -> ModelDescription
  const allModels = [..._knownAzureChatModels, ..._knownOpenAIChatModels];

  /**
   * Fallback: heuristics to map op OpenAI follow:
   *  1. if the name of the model (set by the user) matches exactly a known OpenAI model, use that
   *  2. otherwise match the 'model' field, which SHOULD be the real OpenAI model id
   */
  const isNameAKnownOpenAIModel = !!allModels.find(({ idPrefix: id }) => deploymentName == id);

  const { id: _ignoreThisId, label, hidden: _allVisible, ...restOfModelDescription } = fromManualMapping(
    allModels,
    isNameAKnownOpenAIModel ? deploymentName : likelyTheOpenAIModel,
    modelCreated,
    modelUpdated,
    undefined,
    true,
  );

  // if the user has set a custom name, show it in the label in addition to the generic OpenAI model name
  const preciseLabel = (deploymentName !== likelyTheOpenAIModel) ?
    `${label} (${deploymentName})` : label;

  return {
    id: deploymentName,
    label: preciseLabel,
    ...restOfModelDescription,
  };
}
