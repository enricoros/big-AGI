/**
 * Isomorphic Ollama API access - works on both server and client.
 *
 * This module only imports zod for schema definition and provides access logic
 * that works identically on server and client environments.
 */

import * as z from 'zod/v4';

import { env } from '~/server/env.server';

import { llmsFixupHost } from '../openai/openai.access';


// configuration
const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';


// --- Ollama Access ---

export type OllamaAccessSchema = z.infer<typeof ollamaAccessSchema>;
export const ollamaAccessSchema = z.object({
  dialect: z.enum(['ollama']),
  clientSideFetch: z.boolean().optional(), // optional: backward compatibility from newer server version - can remove once all clients are updated
  ollamaHost: z.string().trim(),
});


export function ollamaAccess(access: OllamaAccessSchema, apiPath: string): { headers: HeadersInit, url: string } {

  const ollamaHost = llmsFixupHost(access.ollamaHost || env.OLLAMA_API_HOST || DEFAULT_OLLAMA_HOST, apiPath);

  return {
    headers: {
      'Content-Type': 'application/json',
    },
    url: ollamaHost + apiPath,
  };
}
