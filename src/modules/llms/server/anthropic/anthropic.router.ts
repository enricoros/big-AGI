import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { env } from '~/server/env.mjs';
import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { fixupHost } from '~/common/util/urlUtils';

import { ListModelsResponse_schema, ModelDescriptionSchema } from '../llm.server.types';

import { hardcodedAnthropicModels } from './anthropic.models';


// Default hosts
const DEFAULT_API_VERSION_HEADERS = {
  'anthropic-version': '2023-06-01',
  // Betas:
  // - messages-2023-12-15: to use the Messages API [now default]
  // - max-tokens-3-5-sonnet-2024-07-15
  //
  // - prompt-caching-2024-07-31: to use the prompt caching feature; adds to any API invocation:
  //   - message_start.message.usage.cache_creation_input_tokens: number
  //   - message_start.message.usage.cache_read_input_tokens: number
  'anthropic-beta': 'computer-use-2024-10-22,prompt-caching-2024-07-31,max-tokens-3-5-sonnet-2024-07-15',
};
const DEFAULT_ANTHROPIC_HOST = 'api.anthropic.com';
const DEFAULT_HELICONE_ANTHROPIC_HOST = 'anthropic.hconeai.com';


// Mappers

async function anthropicGETOrThrow<TOut extends object>(access: AnthropicAccessSchema, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = anthropicAccess(access, apiPath);
  return await fetchJsonOrTRPCThrow<TOut>({ url, headers, name: 'Anthropic' });
}

// async function anthropicPOST<TOut extends object, TPostBody extends object>(access: AnthropicAccessSchema, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
//   const { headers, url } = anthropicAccess(access, apiPath);
//   return await fetchJsonOrTRPCThrow<TOut, TPostBody>({ url, method: 'POST', headers, body, name: 'Anthropic' });
// }

export function anthropicAccess(access: AnthropicAccessSchema, apiPath: string): { headers: HeadersInit, url: string } {
  // API key
  const anthropicKey = access.anthropicKey || env.ANTHROPIC_API_KEY || '';

  // break for the missing key only on the default host
  if (!anthropicKey && !(access.anthropicHost || env.ANTHROPIC_API_HOST))
    throw new Error('Missing Anthropic API Key. Add it on the UI (Models Setup) or server side (your deployment).');

  // API host
  let anthropicHost = fixupHost(access.anthropicHost || env.ANTHROPIC_API_HOST || DEFAULT_ANTHROPIC_HOST, apiPath);

  // Helicone for Anthropic
  // https://docs.helicone.ai/getting-started/integration-method/anthropic
  const heliKey = access.heliconeKey || env.HELICONE_API_KEY || false;
  if (heliKey) {
    if (!anthropicHost.includes(DEFAULT_ANTHROPIC_HOST) && !anthropicHost.includes(DEFAULT_HELICONE_ANTHROPIC_HOST))
      throw new Error(`The Helicone Anthropic Key has been provided, but the host is set to custom. Please fix it in the Models Setup page.`);
    anthropicHost = `https://${DEFAULT_HELICONE_ANTHROPIC_HOST}`;
  }

  // 2024-10-22: we don't support this yet, but the Anthropic SDK has `dangerouslyAllowBrowser: true`
  // to use the API from Browsers via CORS

  return {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...DEFAULT_API_VERSION_HEADERS,
      'X-API-Key': anthropicKey,
      ...(heliKey && { 'Helicone-Auth': `Bearer ${heliKey}` }),
    },
    url: anthropicHost + apiPath,
  };
}


// Input Schemas

export const anthropicAccessSchema = z.object({
  dialect: z.literal('anthropic'),
  anthropicKey: z.string().trim(),
  anthropicHost: z.string().trim().nullable(),
  heliconeKey: z.string().trim().nullable(),
});
export type AnthropicAccessSchema = z.infer<typeof anthropicAccessSchema>;

const listModelsInputSchema = z.object({
  access: anthropicAccessSchema,
});


// Router

export const llmAnthropicRouter = createTRPCRouter({

  /* [Anthropic] list models - https://docs.anthropic.com/claude/docs/models-overview */
  listModels: publicProcedure
    .input(listModelsInputSchema)
    .output(ListModelsResponse_schema)
    .query(async ({ input: { access } }) => {

      // get the models
      const wireModels = await anthropicGETOrThrow(access, '/v1/models?limit=1000');
      const { data: availableModels } = AnthropicWire_API_Models_List.Response_schema.parse(wireModels);

      // cast the models to the common schema
      const models = availableModels.map((model): ModelDescriptionSchema => {

        // use an hardcoded model definition if available
        const hardcodedModel = hardcodedAnthropicModels.find(m => m.id === model.id);
        if (hardcodedModel)
          return hardcodedModel;

        // for day-0 support of new models, create a placeholder model using sensible defaults
        const novelModel = _createPlaceholderModel(model);
        console.log('[DEV] anthropic.router: new model found, please configure it:', novelModel.id);
        return novelModel;
      });

      // developers warning for obsoleted models
      const apiModelIds = new Set(availableModels.map(m => m.id));
      const additionalModels = hardcodedAnthropicModels.filter(m => !apiModelIds.has(m.id));
      if (additionalModels.length > 0)
        console.log('[DEV] anthropic.router: obsoleted models:', additionalModels.map(m => m.id).join(', '));
      // additionalModels.forEach(m => {
      //   m.label += ' (Removed)';
      //   m.isLegacy = true;
      // });
      // models.push(...additionalModels);

      return { models };
    }),

});


/**
 * Create a placeholder ModelDescriptionSchema for models not in the hardcoded list,
 * using sensible defaults with the newest available interfaces.
 */
function _createPlaceholderModel(model: AnthropicWire_API_Models_List.ModelObject): ModelDescriptionSchema {
  return {
    id: model.id,
    label: model.display_name,
    created: Math.round(new Date(model.created_at).getTime() / 1000),
    description: 'Newest model, description not available yet.',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Latest',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    // chatPrice: ...
    // benchmark: ...
  };
}

/**
 * Namespace for the Anthropic API Models List response schema.
 * NOTE: not merged into AIX because of possible circular dependency issues - future work.
 */
namespace AnthropicWire_API_Models_List {

  export type ModelObject = z.infer<typeof ModelObject_schema>;
  const ModelObject_schema = z.object({
    type: z.literal('model'),
    id: z.string(),
    display_name: z.string(),
    created_at: z.string(),
  });

  export type Response = z.infer<typeof Response_schema>;
  export const Response_schema = z.object({
    data: z.array(ModelObject_schema),
    has_more: z.boolean(),
    first_id: z.string().nullable(),
    last_id: z.string().nullable(),
  });

}
