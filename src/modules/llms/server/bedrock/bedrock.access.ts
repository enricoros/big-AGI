/**
 * Isomorphic AWS Bedrock API access - SigV4 signing via aws4fetch + Bearer token auth.
 *
 * This module provides the access schema and signing logic for AWS Bedrock API calls.
 * It supports both the `bedrock` control plane (model listing) and `bedrock-runtime`
 * data plane (model invocation).
 *
 * Two authentication modes:
 * - **Bearer token**: Simple `Authorization: Bearer <token>` header (AWS Bedrock API keys).
 *   Long-term keys (`ABSK...`) support both control plane and runtime.
 *   UNSUPPORTED: Short-term keys (`bedrock-api-key-...`) only support runtime (not model listing).
 * - **SigV4**: Traditional IAM credentials signing via aws4fetch
 *
 * Priority: client bearer > client IAM > server bearer > server IAM.
 * SigV4 uses explicit AWS credentials only (no credential chain) for Edge Runtime compatibility.
 */

import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { AwsClient } from 'aws4fetch';

import { env } from '~/server/env.server';


// configuration
const DEFAULT_BEDROCK_REGION = 'us-east-1'; // default region for Bedrock, used if not provided by client or env


// --- Schema ---

export type BedrockAccessSchema = z.infer<typeof bedrockAccessSchema>;
export const bedrockAccessSchema = z.object({
  dialect: z.literal('bedrock'),
  bedrockBearerToken: z.string().trim(),
  bedrockAccessKeyId: z.string().trim(),
  bedrockSecretAccessKey: z.string().trim(),
  bedrockSessionToken: z.string().trim().nullable(),
  bedrockRegion: z.string().trim(),
  clientSideFetch: z.boolean(),
});


// --- Auth Resolution ---

type BedrockAuthBearer = { type: 'bearer'; bearerToken: string; region: string };
type BedrockAuthSigV4 = { type: 'sigv4'; accessKeyId: string; secretAccessKey: string; sessionToken: string | undefined; region: string };

/** Resolve Bedrock authentication. */
function _bedrockResolveAuth(access: BedrockAccessSchema): BedrockAuthBearer | BedrockAuthSigV4 {

  // 1. Client bearer token (highest priority)
  let region = access.bedrockRegion || DEFAULT_BEDROCK_REGION; // client-provided region
  if (access.bedrockBearerToken)
    return { type: 'bearer', bearerToken: access.bedrockBearerToken, region };

  // 2. Client IAM credentials
  if (access.bedrockAccessKeyId && access.bedrockSecretAccessKey)
    return { type: 'sigv4', accessKeyId: access.bedrockAccessKeyId, secretAccessKey: access.bedrockSecretAccessKey, sessionToken: access.bedrockSessionToken || undefined, region };

  // 3. Server bearer token
  region = env.BEDROCK_REGION || DEFAULT_BEDROCK_REGION; // server-provided region (ignores client for security reasons)
  if (env.BEDROCK_BEARER_TOKEN)
    return { type: 'bearer', bearerToken: env.BEDROCK_BEARER_TOKEN, region };

  // 4. Server IAM credentials
  if (env.BEDROCK_ACCESS_KEY_ID && env.BEDROCK_SECRET_ACCESS_KEY)
    return { type: 'sigv4', accessKeyId: env.BEDROCK_ACCESS_KEY_ID, secretAccessKey: env.BEDROCK_SECRET_ACCESS_KEY, sessionToken: env.BEDROCK_SESSION_TOKEN || undefined, region };

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Missing AWS credentials. Add your Bedrock API Key or IAM Access Key on the UI (Models Setup) or server side (your deployment).',
  });
}

/** Resolve the Bedrock region from access config. */
export function bedrockResolveRegion(access: BedrockAccessSchema): string {
  return _bedrockResolveAuth(access).region;
}


// --- URLs ---

export function bedrockURLControlPlane(region: string, path: string): string {
  return `https://bedrock.${region}.amazonaws.com${path}`;
}

export function bedrockURLMantle(region: string, path: string): string {
  return `https://bedrock-mantle.${region}.api.aws${path}`;
}

export function bedrockURLRuntime(region: string, modelId: string, streaming: boolean): string {
  const action = streaming ? 'invoke-with-response-stream' : 'invoke';
  return `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/${action}`;
}


// --- Bedrock Access (Bearer or async SigV4) ---

/**
 * Prepares a request for AWS Bedrock using either Bearer token or SigV4 signing.
 * Returns { headers, url } like anthropicAccess/geminiAccess, but async due to potential SigV4 signing.
 */
export async function bedrockAccessAsync(
  access: BedrockAccessSchema,
  method: 'GET' | 'POST',
  url: string,
  body?: object,
): Promise<{ headers: HeadersInit; url: string }> {

  const auth = _bedrockResolveAuth(access);

  // -- Bearer token: simple Authorization header --
  if (auth.type === 'bearer')
    return {
      headers: {
        'Authorization': `Bearer ${auth.bearerToken}`,
        'Accept': 'application/json',
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      url,
    };


  // -- SigV4: sign with aws4fetch --
  const awsClient = new AwsClient({
    service: 'bedrock', // Bedrock uses 'bedrock' as the SigV4 service name for both control plane and runtime
    accessKeyId: auth.accessKeyId,
    secretAccessKey: auth.secretAccessKey,
    sessionToken: auth.sessionToken,
    region: auth.region,
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
