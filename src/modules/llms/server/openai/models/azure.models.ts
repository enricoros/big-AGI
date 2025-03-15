import { z } from 'zod';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping } from './models.data';
import { _knownOpenAIChatModels } from './openai.models';


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
  // ... implement your own here ...

  /**
   * Fallback: heuristics to map op OpenAI follow:
   *  1. if the name of the model (set by the user) matches exactly a known OpenAI model, use that
   *  2. otherwise match the 'model' field, which SHOULD be the real OpenAI model id
   */
  const isNameAKnownOpenAIModel = !!_knownOpenAIChatModels.find(({ idPrefix: id }) => deploymentName == id);

  const { id: _ignoreThisId, label, hidden: _allVisible, ...restOfModelDescription } = fromManualMapping(
    _knownOpenAIChatModels,
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
