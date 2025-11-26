/**
 * Isomorphic Anthropic API access - works on both server and client.
 *
 * This module only imports zod for schema definition and provides access logic
 * that works identically on server and client environments.
 */

import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { env } from '~/server/env.server';

import { llmsFixupHost } from '../openai/openai.access';


// configuration
const DEFAULT_ANTHROPIC_HOST = 'api.anthropic.com';
const DEFAULT_HELICONE_ANTHROPIC_HOST = 'anthropic.hconeai.com';

const DEFAULT_ANTHROPIC_HEADERS = {
  // Latest version hasn't changed (as of Feb 2025)
  'anthropic-version': '2023-06-01',

  // Enable CORS for browsers - we don't use this on server
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


// --- Anthropic Access ---

export type AnthropicHeaderOptions = {
  modelIdForBetaFeatures?: string;
  vndAntWebFetch?: boolean;
  vndAnt1MContext?: boolean;
  vndAntEffort?: boolean; // [Anthropic, effort-2025-11-24]
  enableSkills?: boolean;
  enableCodeExecution?: boolean;
  enableStrictOutputs?: boolean; // [Anthropic, 2025-11-13] Structured Outputs (JSON outputs & strict tool use)
  enableToolSearch?: boolean; // [Anthropic, 2025-11-24] Tool Search Tool
  enableProgrammaticToolCalling?: boolean; // [Anthropic, 2025-11-24] Programmatic Tool Calling (allowed_callers, input_examples)
  clientSideFetch?: boolean; // whether the request will be made from client-side (browser) - adds CORS header
};

export type AnthropicAccessSchema = z.infer<typeof anthropicAccessSchema>;
export const anthropicAccessSchema = z.object({
  dialect: z.literal('anthropic'),
  clientSideFetch: z.boolean().optional(), // optional: backward compatibility from newer server version - can remove once all clients are updated
  anthropicKey: z.string().trim(),
  anthropicHost: z.string().trim().nullable(),
  heliconeKey: z.string().trim().nullable(),
});

export function anthropicAccess(access: AnthropicAccessSchema, apiPath: string, options?: AnthropicHeaderOptions): { headers: HeadersInit, url: string } {
  // API key
  const anthropicKey = access.anthropicKey || env.ANTHROPIC_API_KEY || '';

  // break for the missing key only on the default host
  if (!anthropicKey && !(access.anthropicHost || env.ANTHROPIC_API_HOST))
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Anthropic API Key. Add it on the UI (Models Setup) or server side (your deployment).' });

  // API host
  let anthropicHost = llmsFixupHost(access.anthropicHost || env.ANTHROPIC_API_HOST || DEFAULT_ANTHROPIC_HOST, apiPath);

  // Helicone for Anthropic
  // https://docs.helicone.ai/getting-started/integration-method/anthropic
  const heliKey = access.heliconeKey || env.HELICONE_API_KEY || false;
  if (heliKey) {
    if (!anthropicHost.includes(DEFAULT_ANTHROPIC_HOST) && !anthropicHost.includes(DEFAULT_HELICONE_ANTHROPIC_HOST))
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'The Helicone Anthropic Key has been provided, but the host is set to custom. Please fix it in the Models Setup page.' });
    anthropicHost = `https://${DEFAULT_HELICONE_ANTHROPIC_HOST}`;
  }

  // [CSF] add CORS-allow header if client-side fetch
  if (access.clientSideFetch)
    options = { ...options, clientSideFetch: true };

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

  // [Anthropic, 2025-11-24] Add beta feature for effort parameter (Claude Opus 4.5+)
  if (options?.vndAntEffort)
    betaFeatures.push('effort-2025-11-24');

  // [Anthropic, 2025-11-24] Add beta feature for Advanced Tool Use (Tool Search Tool, Programmatic Tool Calling)
  // Same beta header covers both features: tool discovery and programmatic calling from code execution
  if (options?.enableToolSearch || options?.enableProgrammaticToolCalling)
    betaFeatures.push('advanced-tool-use-2025-11-20');

  // [Anthropic, 2025-11-13] Add beta feature for Structured Outputs (JSON outputs & strict tool use)
  if (options?.enableStrictOutputs)
    betaFeatures.push('structured-outputs-2025-11-13');

  return {
    ...DEFAULT_ANTHROPIC_HEADERS,
    // CORS: allow browser access to Anthropic API servers
    ...(options?.clientSideFetch ? { 'anthropic-dangerous-direct-browser-access': 'true' } : {}),
    // Beta features
    ...(betaFeatures.length ? { 'anthropic-beta': betaFeatures.join(',') } : {}),
  };
}
