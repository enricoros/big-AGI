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

import { AwsClient } from 'aws4fetch';

import { env } from '~/server/env.server';


// --- Schema ---

export type BedrockAccessSchema = z.infer<typeof bedrockAccessSchema>;
export const bedrockAccessSchema = z.object({
  dialect: z.literal('bedrock'),
  bedrockAccessKeyId: z.string().trim(),
  bedrockSecretAccessKey: z.string().trim(),
  bedrockSessionToken: z.string().trim().nullable(),
  bedrockRegion: z.string().trim(),
  clientSideFetch: z.boolean(),
});


// --- Credential & Region Resolution ---

/**
 * Resolve all Bedrock access config: credentials (all-or-none) + region.
 * If the user provides an access key, all credentials come from user; otherwise all from env.
 */
export function bedrockServerConfig(access: BedrockAccessSchema) {
  const userProvided = !!access.bedrockAccessKeyId;
  const accessKeyId = userProvided ? access.bedrockAccessKeyId : (env.BEDROCK_ACCESS_KEY_ID || '');
  const secretAccessKey = userProvided ? access.bedrockSecretAccessKey : (env.BEDROCK_SECRET_ACCESS_KEY || '');
  const sessionToken = (userProvided ? access.bedrockSessionToken : env.BEDROCK_SESSION_TOKEN) || undefined;
  const region = (userProvided ? access.bedrockRegion : env.BEDROCK_REGION) || 'us-east-1';

  if (!accessKeyId || !secretAccessKey)
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Missing AWS credentials. Add your Access Key ID and Secret Access Key on the UI (Models Setup) or server side (your deployment).',
    });

  return { accessKeyId, secretAccessKey, sessionToken, region };
}


// --- URLs ---

export function bedrockURLRuntime(region: string, modelId: string, streaming: boolean): string {
  const action = streaming ? 'invoke-with-response-stream' : 'invoke';
  return `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/${action}`;
}

export function bedrockURLControlPlane(region: string, path: string): string {
  return `https://bedrock.${region}.amazonaws.com${path}`;
}


// --- Bedrock Access (async SigV4) ---

/**
 * Signs a request for AWS Bedrock using SigV4 via aws4fetch.
 * Returns { headers, url } like anthropicAccess/geminiAccess, but async due to SigV4 signing.
 */
export async function bedrockAccessAsync(
  access: BedrockAccessSchema,
  method: 'GET' | 'POST',
  url: string,
  body?: object,
): Promise<{ headers: HeadersInit; url: string }> {

  const { accessKeyId, secretAccessKey, sessionToken, region } = bedrockServerConfig(access);

  const awsClient = new AwsClient({
    service: 'bedrock', // Bedrock uses 'bedrock' as the SigV4 service name for both control plane and runtime
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region,
  });

  // sign the request - uses SubtleCrypto
  const signedRequest = await awsClient.sign(url, {
    method,
    headers: {
      'Accept': 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  } satisfies RequestInit);

  // extract headers from the signed Request
  const headers: Record<string, string> = {};
  signedRequest.headers.forEach((value, key) => headers[key] = value);

  return { headers, url };
}
