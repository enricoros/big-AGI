/**
 * Isomorphic AWS Bedrock API access - SigV4 signing via aws4fetch.
 *
 * This module provides the access schema and signing logic for AWS Bedrock API calls.
 * It supports both the `bedrock` control plane (model listing) and `bedrock-runtime`
 * data plane (model invocation).
 *
 * Authentication uses explicit AWS credentials only (no credential chain) for
 * Edge Runtime compatibility. aws4fetch auto-detects service and region from URLs.
 */

import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { env } from '~/server/env.server';


// --- Schema ---

export type BedrockAccessSchema = z.infer<typeof bedrockAccessSchema>;
export const bedrockAccessSchema = z.object({
  dialect: z.literal('bedrock'),
  bedrockAccessKeyId: z.string().trim(),
  bedrockSecretAccessKey: z.string().trim(),
  bedrockSessionToken: z.string().trim().nullable(),
  bedrockRegion: z.string().trim(),
});


// --- URLs ---

/**
 * Build a Bedrock Runtime URL for model invocation.
 * Service: bedrock-runtime (auto-detected by aws4fetch from hostname)
 */
export function bedrockRuntimeURL(region: string, modelId: string, streaming: boolean): string {
  const action = streaming ? 'invoke-with-response-stream' : 'invoke';
  return `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/${action}`;
}

/**
 * Build a Bedrock control plane URL for model listing.
 * Service: bedrock (auto-detected by aws4fetch from hostname)
 */
export function bedrockControlPlaneURL(region: string, path: string): string {
  return `https://bedrock.${region}.amazonaws.com${path}`;
}


// --- SigV4 Signing ---

/**
 * Signs an HTTP request for AWS Bedrock using SigV4 via aws4fetch.
 * Returns signed headers that can be passed to fetch().
 *
 * @param access - Bedrock credentials and region
 * @param url - Full URL to sign
 * @param body - Optional JSON body (required for POST, included in signature)
 * @param method - HTTP method (default: POST)
 * @returns Signed headers including Authorization, x-amz-date, etc.
 */
export async function bedrockSignRequest(
  access: BedrockAccessSchema,
  url: string,
  body?: object,
  method: 'GET' | 'POST' = 'POST',
): Promise<HeadersInit> {

  // resolve credentials (user-provided > env vars)
  const accessKeyId = access.bedrockAccessKeyId || env.AWS_ACCESS_KEY_ID || '';
  const secretAccessKey = access.bedrockSecretAccessKey || env.AWS_SECRET_ACCESS_KEY || '';
  const sessionToken = access.bedrockSessionToken || env.AWS_SESSION_TOKEN || undefined;

  if (!accessKeyId || !secretAccessKey)
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Missing AWS credentials. Add your Access Key ID and Secret Access Key on the UI (Models Setup) or server side (your deployment).',
    });

  // dynamic import to keep aws4fetch out of the CSF client bundle
  const { AwsClient } = await import('aws4fetch');

  const awsClient = new AwsClient({
    accessKeyId,
    secretAccessKey,
    sessionToken,
  });

  // Build the request for signing
  const requestInit: RequestInit = {
    method,
    headers: {
      'Accept': 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  // Sign the request (uses SubtleCrypto.digest - async)
  const signedRequest = await awsClient.sign(url, requestInit);

  // Extract headers from the signed Request object
  const headers: Record<string, string> = {};
  signedRequest.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return headers;
}
