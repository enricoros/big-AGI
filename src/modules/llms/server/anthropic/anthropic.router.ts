import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { env } from '~/server/env';
import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_Tools_WebSearch } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import { ListModelsResponse_schema, ModelDescriptionSchema } from '../llm.server.types';

import { hardcodedAnthropicModels, hardcodedAnthropicVariants } from './anthropic.models';
import { fixupHost } from '~/modules/llms/server/openai/openai.router';


// configuration and defaults
const DEFAULT_ANTHROPIC_HOST = 'api.anthropic.com';
const DEFAULT_HELICONE_ANTHROPIC_HOST = 'anthropic.hconeai.com';

const DEV_DEBUG_ANTHROPIC_MODELS = Release.IsNodeDevBuild;

const DEFAULT_ANTHROPIC_HEADERS = {
  // Latest version hasn't changed (as of Feb 2025)
  'anthropic-version': '2023-06-01',

  // Enable CORS for browsers - we don't use this
  // 'anthropic-dangerous-direct-browser-access': 'true',

  // Used for instance by Claude Code - shall we set it
  // 'x-app': 'big-agi',
} as const;

const DEFAULT_ANTHROPIC_BETA_FEATURES: string[] = [

  // NOTE: undocumented: I wonder what this is for
  // 'claude-code-20250219',

  // NOTE: disabled for now, as we don't have tested side-effects for this feature yet
  // 'token-efficient-tools-2025-02-19', // https://docs.anthropic.com/en/docs/build-with-claude/tool-use/token-efficient-tool-use

  /**
   * to use the prompt caching feature; adds to any API invocation:
   *  - message_start.message.usage.cache_creation_input_tokens: number
   *  - message_start.message.usage.cache_read_input_tokens: number
   */
  'prompt-caching-2024-07-31',

  /**
   * Enables model_context_window_exceeded stop reason for models earlier than Sonnet 4.5
   * (Sonnet 4.5+ have this by default). This allows requesting max tokens without calculating
   * input size, and the API will return as much as possible within the context window.
   * https://docs.claude.com/en/api/handling-stop-reasons#model-context-window-exceeded
   */
  // 'model-context-window-exceeded-2025-08-26',

  // now default
  // 'messages-2023-12-15'
] as const;

const PER_MODEL_BETA_FEATURES: { [modelId: string]: string[] } = {
  'claude-3-7-sonnet-20250219': [

    /** enables long output for the 3.7 Sonnet model */
    'output-128k-2025-02-19',

    /** computer Tools for Sonnet 3.7 [computer_20250124, text_editor_20250124, bash_20250124] */
    'computer-use-2025-01-24',

  ] as const,
} as const;

type AnthropicHeaderOptions = {
  modelIdForBetaFeatures?: string;
  vndAntWebFetch?: boolean;
  vndAnt1MContext?: boolean;
  enableSkills?: boolean;
  enableCodeExecution?: boolean;
};

function _anthropicHeaders(options?: AnthropicHeaderOptions): Record<string, string> {

  // accumulate the beta features
  const betaFeatures = [...DEFAULT_ANTHROPIC_BETA_FEATURES];
  if (options?.modelIdForBetaFeatures) {
    // string search (.includes) within the keys, to be more resilient to modelId changes/prefixing
    for (const [key, value] of Object.entries(PER_MODEL_BETA_FEATURES))
      if (key.includes(options.modelIdForBetaFeatures))
        betaFeatures.push(...value);
  }

  // Add beta feature for web-fetch if enabled
  // Note: web-fetch-2025-09-10 is documented in official API docs but not yet in TypeScript SDK types
  if (options?.vndAntWebFetch)
    betaFeatures.push('web-fetch-2025-09-10');

  // Add beta feature for 1M context window if enabled
  if (options?.vndAnt1MContext)
    betaFeatures.push('context-1m-2025-08-07');

  // Add beta features for Skills API
  if (options?.enableSkills) {
    betaFeatures.push('skills-2025-10-02');
    betaFeatures.push('files-api-2025-04-14'); // For file downloads
  }

  // Add beta feature for code execution (required for Skills)
  if (options?.enableCodeExecution || options?.enableSkills) {
    betaFeatures.push('code-execution-2025-08-25');
  }

  // Note: web-search is now GA and no longer requires a beta header

  return {
    ...DEFAULT_ANTHROPIC_HEADERS,
    'anthropic-beta': betaFeatures.join(','),
  };
}


// Mappers

async function anthropicGETOrThrow<TOut extends object>(access: AnthropicAccessSchema, apiPath: string, options?: AnthropicHeaderOptions, signal?: AbortSignal): Promise<TOut> {
  const { headers, url } = anthropicAccess(access, apiPath, options);
  return await fetchJsonOrTRPCThrow<TOut>({ url, headers, name: 'Anthropic', signal });
}

// async function anthropicPOST<TOut extends object, TPostBody extends object>(access: AnthropicAccessSchema, apiPath: string, body: TPostBody, options?: AnthropicHeaderOptions, signal?: AbortSignal): Promise<TOut> {
//   const { headers, url } = anthropicAccess(access, apiPath, options);
//   return await fetchJsonOrTRPCThrow<TOut, TPostBody>({ url, method: 'POST', headers, body, name: 'Anthropic', signal });
// }

export function anthropicAccess(access: AnthropicAccessSchema, apiPath: string, options?: AnthropicHeaderOptions): { headers: HeadersInit, url: string } {
  // API key
  const anthropicKey = access.anthropicKey || env.ANTHROPIC_API_KEY || '';

  // break for the missing key only on the default host
  if (!anthropicKey && !(access.anthropicHost || env.ANTHROPIC_API_HOST))
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Anthropic API Key. Add it on the UI (Models Setup) or server side (your deployment).' });

  // API host
  let anthropicHost = fixupHost(access.anthropicHost || env.ANTHROPIC_API_HOST || DEFAULT_ANTHROPIC_HOST, apiPath);

  // Helicone for Anthropic
  // https://docs.helicone.ai/getting-started/integration-method/anthropic
  const heliKey = access.heliconeKey || env.HELICONE_API_KEY || false;
  if (heliKey) {
    if (!anthropicHost.includes(DEFAULT_ANTHROPIC_HOST) && !anthropicHost.includes(DEFAULT_HELICONE_ANTHROPIC_HOST))
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'The Helicone Anthropic Key has been provided, but the host is set to custom. Please fix it in the Models Setup page.' });
    anthropicHost = `https://${DEFAULT_HELICONE_ANTHROPIC_HOST}`;
  }

  // 2024-10-22: we don't support this yet, but the Anthropic SDK has `dangerouslyAllowBrowser: true`
  // to use the API from Browsers via CORS

  return {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ..._anthropicHeaders(options),
      'X-API-Key': anthropicKey,
      ...(heliKey && { 'Helicone-Auth': `Bearer ${heliKey}` }),
    },
    url: anthropicHost + apiPath,
  };
}

function roundTime(date: string) {
  return Math.round(new Date(date).getTime() / 1000);
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


// Helpers

/**
 * Injects the LLM_IF_Tools_WebSearch interface for models that have web search/fetch parameters.
 * This allows the UI to show the web search indicator automatically based on model capabilities.
 */
function _injectWebSearchInterface(model: ModelDescriptionSchema): ModelDescriptionSchema {
  const hasWebParams = model.parameterSpecs?.some(spec =>
    spec.paramId === 'llmVndAntWebSearch' || spec.paramId === 'llmVndAntWebFetch'
  );
  return (hasWebParams && !model.interfaces?.includes(LLM_IF_Tools_WebSearch)) ? {
    ...model,
    interfaces: [...model.interfaces, LLM_IF_Tools_WebSearch],
  } : model;
}


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

      // sort by: family (desc) > class (desc) > date (desc) -- Future NOTE: -5- will match -4-5- and -3-5-.. figure something else out
      const familyPrecedence = ['-4-7-', '-4-5-', '-4-1-', '-4-', '-3-7-', '-3-5-', '-3-'];
      const classPrecedence = ['-opus-', '-sonnet-', '-haiku-'];

      const getFamilyIdx = (id: string) => familyPrecedence.findIndex(f => id.includes(f));
      const getClassIdx = (id: string) => classPrecedence.findIndex(c => id.includes(c));

      // cast the models to the common schema
      const models = availableModels
        .sort((a, b) => {
          const familyA = getFamilyIdx(a.id);
          const familyB = getFamilyIdx(b.id);
          const classA = getClassIdx(a.id);
          const classB = getClassIdx(b.id);

          // family desc (lower index = better, -1 = unknown goes last)
          if (familyA !== familyB) return (familyA === -1 ? 999 : familyA) - (familyB === -1 ? 999 : familyB);
          // class desc
          if (classA !== classB) return (classA === -1 ? 999 : classA) - (classB === -1 ? 999 : classB);
          // date desc (newer first) - string comparison works since format is YYYYMMDD
          return b.id.localeCompare(a.id);
        })
        .reduce((acc, model) => {

          // find the model description
          const hardcodedModel = hardcodedAnthropicModels.find(m => m.id === model.id);
          if (hardcodedModel) {

            // update creation date
            if (!hardcodedModel.created && model.created_at)
              hardcodedModel.created = roundTime(model.created_at);

            // add FIRST a thinking variant, if defined
            if (hardcodedAnthropicVariants[model.id])
              acc.push({
                ...hardcodedModel,
                ...hardcodedAnthropicVariants[model.id],
              });

            // add the base model
            acc.push(hardcodedModel);

          } else {

            // for day-0 support of new models, create a placeholder model using sensible defaults
            const novelModel = _createPlaceholderModel(model);
            // if (DEV_DEBUG_ANTHROPIC_MODELS) // kind of important...
            console.log('[DEV] anthropic.router: new model found, please configure it:', novelModel.id);
            acc.push(novelModel);

          }

          return acc;
        }, [] as ModelDescriptionSchema[])
        .map(_injectWebSearchInterface);

      // developers warning for obsoleted models (we have them, but they are not in the API response anymore)
      if (DEV_DEBUG_ANTHROPIC_MODELS) {
        const apiModelIds = new Set(availableModels.map(m => m.id));
        const additionalModels = hardcodedAnthropicModels.filter(m => !apiModelIds.has(m.id));
        if (additionalModels.length > 0)
          console.log('[DEV] anthropic.router: obsoleted models:', additionalModels.map(m => m.id).join(', '));
      }

      // additionalModels.forEach(m => {
      //   m.label += ' (Removed)';
      //   m.isLegacy = true;
      // });
      // models.push(...additionalModels);

      return { models };
    }),

  /* [Anthropic] list skills - https://docs.anthropic.com/en/docs/build-with-claude/skills-api */
  listSkills: publicProcedure
    .input(z.object({ access: anthropicAccessSchema }))
    .query(async ({ input: { access } }) => {
      return await anthropicGETOrThrow(access, '/v1/skills', { enableSkills: true });
    }),

  /* [Anthropic] get skill details */
  getSkill: publicProcedure
    .input(z.object({
      access: anthropicAccessSchema,
      skillId: z.string(),
    }))
    .query(async ({ input: { access, skillId } }) => {
      return await anthropicGETOrThrow(access, `/v1/skills/${skillId}`, { enableSkills: true });
    }),

  /* [Anthropic] get file metadata - for Skills-generated files */
  getFileMetadata: publicProcedure
    .input(z.object({
      access: anthropicAccessSchema,
      fileId: z.string(),
    }))
    .query(async ({ input: { access, fileId } }) => {
      return await anthropicGETOrThrow(access, `/v1/files/${fileId}`, { enableSkills: true });
    }),

  /* [Anthropic] download file - for Skills-generated files */
  downloadFile: publicProcedure
    .input(z.object({
      access: anthropicAccessSchema,
      fileId: z.string(),
    }))
    .query(async ({ input: { access, fileId } }) => {
      // Return file data - could be integrated with ZYNC Assets in the future
      return await anthropicGETOrThrow(access, `/v1/files/${fileId}/download`, { enableSkills: true });
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
