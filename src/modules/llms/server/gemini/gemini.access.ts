/**
 * Isomorphic Gemini API access - works on both server and client.
 *
 * This module only imports zod for schema definition and provides access logic
 * that works identically on server and client environments.
 *
 * Server: Uses header-based auth (x-goog-api-key) with package version
 * Client: Uses query param auth (?key=) for CORS compatibility
 */
import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import packageJson from '../../../../../package.json';

import { env } from '~/server/env.server';

import { GeminiWire_Safety } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';

import { llmsFixupHost, llmsRandomKeyFromMultiKey } from '../openai/openai.access';


// configuration
const DEFAULT_GEMINI_HOST = 'https://generativelanguage.googleapis.com';


// --- Gemini Access ---

export type GeminiAccessSchema = z.infer<typeof geminiAccessSchema>;
export const geminiAccessSchema = z.object({
  dialect: z.enum(['gemini']),
  clientSideFetch: z.boolean().optional(), // optional: backward compatibility from newer server version - can remove once all clients are updated
  geminiKey: z.string(),
  geminiHost: z.string(),
  minSafetyLevel: GeminiWire_Safety.HarmBlockThreshold_enum,
});


export function geminiAccess(access: GeminiAccessSchema, modelRefId: string | null, apiPath: string, useV1Alpha: boolean): { headers: HeadersInit, url: string } {

  const geminiHost = llmsFixupHost(access.geminiHost || DEFAULT_GEMINI_HOST, apiPath);
  let geminiKey = access.geminiKey || env.GEMINI_API_KEY || '';

  // multi-key with random selection - https://github.com/enricoros/big-AGI/issues/653
  geminiKey = llmsRandomKeyFromMultiKey(geminiKey);

  // validate key
  if (!geminiKey)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Gemini API Key' });

  // update model-dependent paths
  if (apiPath.includes('{model=models/*}')) {
    if (!modelRefId)
      throw new TRPCError({ code: 'BAD_REQUEST', message: `geminiAccess: modelRefId is required for ${apiPath}` });
    apiPath = apiPath.replace('{model=models/*}', modelRefId);
  }

  // [Gemini, 2025-01-23] CoT support - requires `v1alpha` Gemini API
  if (useV1Alpha)
    apiPath = apiPath.replaceAll('v1beta', 'v1alpha');

  // [CSF] build headers and URL
  if (access.clientSideFetch) {
    const separator = apiPath.includes('?') ? '&' : '?';
    return {
      headers: {
        'Content-Type': 'application/json',
      },
      url: `${geminiHost}${apiPath}${separator}key=${geminiKey}`,
    };
  }

  // server-side fetch
  return {
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-client': `big-agi/${packageJson['version'] || '1.0.0'}`,
      'x-goog-api-key': geminiKey,
    },
    url: geminiHost + apiPath,
  };
}
