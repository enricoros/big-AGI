import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/server/api/trpc.server';
import { env } from '~/server/env.mjs';
import { fetchJsonOrTRPCThrow } from '~/server/api/trpc.router.fetchers';

import { fixupHost } from '~/common/util/urlUtils';

import { ListModelsResponse_schema } from '../llm.server.types';

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
  'anthropic-beta': 'prompt-caching-2024-07-31,max-tokens-3-5-sonnet-2024-07-15',
};
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_ANTHROPIC_HOST = 'api.anthropic.com';
const DEFAULT_HELICONE_ANTHROPIC_HOST = 'anthropic.hconeai.com';


// Mappers

async function anthropicPOST<TOut extends object, TPostBody extends object>(access: AnthropicAccessSchema, body: TPostBody, apiPath: string /*, signal?: AbortSignal*/): Promise<TOut> {
  const { headers, url } = anthropicAccess(access, apiPath);
  return await fetchJsonOrTRPCThrow<TOut, TPostBody>({ url, method: 'POST', headers, body, name: 'Anthropic' });
}

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
    .query(() => ({ models: hardcodedAnthropicModels })),

});
