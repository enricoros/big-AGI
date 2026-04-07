/**
 * Isomorphic Anthropic API access - works on both server and client.
 *
 * This module only imports zod for schema definition and provides access logic
 * that works identically on server and client environments.
 */

import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { env } from '~/server/env.server';

import { llmsFixupHost, llmsHostnameMatches } from '../openai/openai.access';


// configuration
const DEFAULT_ANTHROPIC_HOST = 'api.anthropic.com';
const DEFAULT_HELICONE_ANTHROPIC_HOST = 'anthropic.hconeai.com';

/**
 * Centralized Anthropic API paths.
 */
export const ANTHROPIC_API_PATHS = {
  // Messages
  messages: '/v1/messages', // POST: create a message (chat completion)
  // /v1/messages/count_tokens, // POST: count tokens in a message

  // Models
  models: '/v1/models', // GET: List Models

  // Skills
  skills: '/v1/skills', // POST: create, GET: list
  // /v1/skills/{skill_id} // GET: get skill, DELETE: delete skill

  // Files
  files: '/v1/files', // POST: upload file, GET: list files,
  // /v1/files/{file_id} // GET: get file metadata, DELETE: delete file
  // /v1/files/{file_id}/content // GET: download file
} as const;


const ANTHROPIC_HEADERS_VERSION = {
  // Latest version hasn't changed (as of Feb 2025)
  'anthropic-version': '2023-06-01',

  // Used for instance by Claude Code - shall we set it?
  // 'x-app': 'big-agi',
} as const;

const ANTHROPIC_HEADERS_CORS = {
  // CORS header to allow browser access to Anthropic API servers
  'anthropic-dangerous-direct-browser-access': 'true',
} as const;

const DEFAULT_ANTHROPIC_BETA_FEATURES: string[] = [

  // See this for a full index:
  //   https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/resources/beta/beta.ts#L256

  // Known SDK beta headers (for reference, not all used):
  //   prompt-caching-2024-07-31        -- GA: no longer needed
  //   pdfs-2024-09-25                  -- GA: no longer needed
  //   token-efficient-tools-2025-02-19 -- GA on Claude 4+; still works on 3.7 but side-effects untested
  //   extended-cache-ttl-2025-04-11    -- GA: ttl:'1h' in request body is sufficient
  //   interleaved-thinking-2025-05-14  -- deprecated on Opus 4.6 (adaptive); still REQUIRED for Claude 4.0/4.1/4.5
  //   context-management-2025-06-27    -- for context_management edits (e.g. clear_tool_uses)
  //   model-context-window-exceeded-2025-08-26 -- GA on Claude 4.5+

  // Uncomment if interleaved thinking is needed for Claude 4.0-4.5 models:
  // 'interleaved-thinking-2025-05-14',

] as const;

const PER_MODEL_BETA_FEATURES: { [modelId: string]: string[] } = {
  'claude-3-7-sonnet-20250219': [

    /** enables long output for the 3.7 Sonnet model - no effect on Claude 4+ (native 128k) */
    'output-128k-2025-02-19',

    /** computer Tools for Sonnet 3.7 [computer_20250124, text_editor_20250124, bash_20250124] */
    'computer-use-2025-01-24',

  ] as const,

  // Computer use on newer models requires a different beta header:
  //   computer-use-2025-01-24 -> Sonnet 3.7, Sonnet 4, Opus 4, Opus 4.1, Sonnet 4.5, Haiku 4.5
  //   computer-use-2025-11-24 -> Opus 4.5, Sonnet 4.6, Opus 4.6 (adds enable_zoom)
  // Uncomment and adjust model IDs when computer use is enabled for these models:
  // 'claude-sonnet-4-6': ['computer-use-2025-11-24'] as const,
  // 'claude-opus-4-6': ['computer-use-2025-11-24'] as const,
  // 'claude-opus-4-5': ['computer-use-2025-11-24'] as const,
  // 'claude-sonnet-4-5': ['computer-use-2025-01-24'] as const,
} as const;


// --- Anthropic Access ---

export type AnthropicHostedFeatures = {
  disableAllHostedTools?: boolean;
  enable1MContext?: boolean;
  enableCodeExecution?: boolean;
  enableFastMode?: boolean; // [Anthropic, fast-mode-2026-02-01]
  enableSkills?: boolean;
  enableStrictOutputs?: boolean; // [Anthropic, 2025-11-13] Structured Outputs (JSON outputs & strict tool use)
  enableToolAdvanced20251120?: boolean; // [Anthropic, 2025-11-24] Tool Search Tool + Programmatic Tool Calling (umbrella header)
  modelIdForPerModelFeatures?: string;
};

export type AnthropicAccessSchema = z.infer<typeof anthropicAccessSchema>;
export const anthropicAccessSchema = z.object({
  dialect: z.literal('anthropic'),
  clientSideFetch: z.boolean().optional(), // optional: backward compatibility from newer server version - can remove once all clients are updated
  anthropicKey: z.string().trim(),
  anthropicHost: z.string().trim().nullable(),
  heliconeKey: z.string().trim().nullable(),
  anthropicInferenceGeo: z.string().trim().nullable().optional(), // [Anthropic, 2026-02-01] e.g. "us" for US-only inference, optional: for server backward-comp, and can be removed
});

export function anthropicAccess(access: AnthropicAccessSchema, apiPath: string, options?: AnthropicHostedFeatures): { headers: HeadersInit, url: string } {
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
    if (!llmsHostnameMatches(anthropicHost, DEFAULT_ANTHROPIC_HOST) && !llmsHostnameMatches(anthropicHost, DEFAULT_HELICONE_ANTHROPIC_HOST))
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'The Helicone Anthropic Key has been provided, but the host is set to custom. Please fix it in the Models Setup page.' });
    anthropicHost = `https://${DEFAULT_HELICONE_ANTHROPIC_HOST}`;
  }

  // Beta features
  const betaFeatures = anthropicBetaFeatures(options);

  return {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      // anthropic-version
      ...ANTHROPIC_HEADERS_VERSION,
      // [CSF] add CORS-allow header to allow browser access to Anthropic API servers
      ...(access.clientSideFetch && ANTHROPIC_HEADERS_CORS),
      // Beta features
      ...(betaFeatures.length && { 'anthropic-beta': betaFeatures.join(',') }),
      'X-API-Key': anthropicKey,
      ...(heliKey && { 'Helicone-Auth': `Bearer ${heliKey}` }),
    },
    url: anthropicHost + apiPath,
  };
}


/**
 * Build the list of Anthropic beta feature strings from options.
 * Used by both the direct Anthropic path (as header) and Bedrock path (as body field).
 */
export function anthropicBetaFeatures(options?: AnthropicHostedFeatures): string[] {
  const bf = new Set(DEFAULT_ANTHROPIC_BETA_FEATURES);

  // Per-model beta features
  if (options?.modelIdForPerModelFeatures) {
    // string search (.includes) within the keys, to be more resilient to modelId changes/prefixing
    for (const [key, value] of Object.entries(PER_MODEL_BETA_FEATURES))
      if (key.includes(options.modelIdForPerModelFeatures))
        value.forEach(f => bf.add(f));
  }

  // Add beta feature for 1M context window if enabled
  if (options?.enable1MContext)
    bf.add('context-1m-2025-08-07');

  // Code execution (for dynamic web tools PFC, or Skills) + files API for container downloads
  // Note: SDK defines code-execution-2025-05-22; we use 2025-08-25 (newer iteration, not yet in SDK types).
  // Code execution may be GA now (most SDK examples skip the beta namespace), but keeping for safety.
  if (options?.enableCodeExecution) {
    bf.add('code-execution-2025-08-25');
    bf.add('files-api-2025-04-14');
  }

  // [Anthropic, fast-mode-2026-02-01] Fast inference mode
  if (options?.enableFastMode)
    bf.add('fast-mode-2026-02-01');

  // Skills also requires +enableCodeExecution
  if (options?.enableSkills)
    bf.add('skills-2025-10-02');

  // [Anthropic, 2025-11-13] Structured Outputs (JSON outputs & strict tool use)
  // GA on Claude 4.5+ via output_config.format (which we use). SDK auto-injects structured-outputs-2025-12-15.
  // Keeping older header as safety net for pre-4.5 models; harmless on newer ones.
  // Bedrock / AWS may still require: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
  if (options?.enableStrictOutputs)
    bf.add('structured-outputs-2025-11-13');

  // [Anthropic, 2025-11-24] Advanced Tool Use (Tool Search Tool, Programmatic Tool Calling)
  // Same beta header covers both features: tool discovery and programmatic calling from code execution.
  // Note: advanced-tool-use-2025-11-20 is NOT in the SDK AnthropicBeta type union (possibly private/undocumented).
  if (options?.enableToolAdvanced20251120)
    bf.add('advanced-tool-use-2025-11-20');

  return [...bf];
}
