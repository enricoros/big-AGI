/**
 * Isomorphic Gemini / Vertex AI API access - works on both server and client.
 *
 * Auth modes:
 * - **API key** (default): `x-goog-api-key` / `?key=` against generativelanguage.googleapis.com
 * - **Bearer token** (Vertex AI / ADC / enterprise gateways): `Authorization: Bearer <token>`
 *   against aiplatform.googleapis.com (or a custom host), with project/location path structure.
 *
 * Dynamic tokens (issue #1134): the web app cannot run `gcloud`. Supported patterns:
 * 1. Paste a short-lived token in the UI (bearer field)
 * 2. Server-side env `VERTEX_AI_BEARER_TOKEN` refreshed by an external process/sidecar
 * 3. Optional custom host for proxies / self-hosted gateways
 *
 * @see https://github.com/enricoros/big-AGI/issues/1134
 */
import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import packageJson from '../../../../../package.json';

import { env } from '~/server/env.server';

import { GeminiWire_Safety } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';

import { llmsFixupHost } from '../../shared/llm.isomorphic';
import { llmsRandomKeyFromMultiKey } from '../openai/openai.access';


// configuration
const DEFAULT_GEMINI_HOST = 'https://generativelanguage.googleapis.com';
const DEFAULT_VERTEX_HOST = 'https://aiplatform.googleapis.com';
const DEFAULT_VERTEX_LOCATION = 'us-central1';


// --- Gemini Access ---

export type GeminiAccessSchema = z.infer<typeof geminiAccessSchema>;
export const geminiAccessSchema = z.object({
  dialect: z.enum(['gemini']),
  clientSideFetch: z.boolean().optional(), // optional: backward compatibility from newer server version - can remove once all clients are updated
  geminiKey: z.string(),
  geminiHost: z.string(),
  minSafetyLevel: GeminiWire_Safety.HarmBlockThreshold_enum,
  /** Vertex AI / enterprise: short-lived bearer token (ADC, gateway-issued JWT, etc.) */
  geminiBearerToken: z.string().optional(),
  /** GCP project id for Vertex AI path construction */
  vertexProjectId: z.string().optional(),
  /** Vertex location, e.g. us-central1 or global */
  vertexLocation: z.string().optional(),
});


/**
 * Resolve whether this access config should use Vertex-style Bearer auth + path.
 * Priority: client bearer > server VERTEX_AI_BEARER_TOKEN (when project is known).
 */
function _resolveVertexMode(access: GeminiAccessSchema): {
  useVertex: boolean;
  bearerToken: string;
  projectId: string;
  location: string;
  hostDefault: string;
} {
  const bearerToken =
    (access.geminiBearerToken || '').trim()
    || (env as { VERTEX_AI_BEARER_TOKEN?: string }).VERTEX_AI_BEARER_TOKEN?.trim()
    || '';

  const projectId =
    (access.vertexProjectId || '').trim()
    || (env as { VERTEX_AI_PROJECT_ID?: string }).VERTEX_AI_PROJECT_ID?.trim()
    || (env as { GOOGLE_CLOUD_PROJECT?: string }).GOOGLE_CLOUD_PROJECT?.trim()
    || '';

  const location =
    (access.vertexLocation || '').trim()
    || (env as { VERTEX_AI_LOCATION?: string }).VERTEX_AI_LOCATION?.trim()
    || DEFAULT_VERTEX_LOCATION;

  // Vertex mode requires a bearer token. Project is required for generateContent paths
  // that include a model; list-models may still work via custom host + bearer only.
  const useVertex = !!bearerToken;

  return {
    useVertex,
    bearerToken,
    projectId,
    location: location || DEFAULT_VERTEX_LOCATION,
    hostDefault: useVertex ? DEFAULT_VERTEX_HOST : DEFAULT_GEMINI_HOST,
  };
}


/**
 * Map Developer API paths onto Vertex AI path shapes when in Vertex mode.
 *
 * Developer API:  /v1beta/models/{model}:generateContent
 * Vertex AI:      /v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent
 *
 * Model ids may arrive as `models/gemini-2.5-flash` or bare `gemini-2.5-flash`.
 */
function _toVertexApiPath(apiPath: string, projectId: string, location: string, modelRefId: string | null): string {
  if (!projectId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Vertex AI mode requires a GCP project id (UI field or VERTEX_AI_PROJECT_ID / GOOGLE_CLOUD_PROJECT env).',
    });
  }

  // Extract model segment from modelRefId or from the path placeholder
  let modelId = modelRefId || '';
  if (modelId.startsWith('models/'))
    modelId = modelId.slice('models/'.length);

  // generateContent / streamGenerateContent
  if (apiPath.includes(':generateContent') || apiPath.includes(':streamGenerateContent')) {
    if (!modelId && apiPath.includes('{model=models/*}')) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'geminiAccess: modelRefId is required for Vertex generateContent' });
    }
    if (apiPath.includes('{model=models/*}') && modelId)
      apiPath = apiPath.replace('{model=models/*}', modelId);

    // Strip leading /v1beta or /v1alpha and rebuild Vertex path
    const actionMatch = apiPath.match(/:(streamGenerateContent|generateContent)(.*)$/);
    const action = actionMatch ? actionMatch[1] : 'generateContent';
    const query = actionMatch?.[2] || '';
    // Prefer model id already substituted into path
    const pathModel = apiPath.match(/models\/([^/:]+)/)?.[1] || modelId;
    if (!pathModel)
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'geminiAccess: cannot resolve model id for Vertex path' });

    return `/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(pathModel)}:${action}${query}`;
  }

  // models list
  if (apiPath.includes('/models') && !apiPath.includes(':')) {
    return `/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models`;
  }

  // Fallback: leave path as-is (custom endpoints / proxies may accept Developer API shapes)
  if (apiPath.includes('{model=models/*}')) {
    if (!modelRefId)
      throw new TRPCError({ code: 'BAD_REQUEST', message: `geminiAccess: modelRefId is required for ${apiPath}` });
    apiPath = apiPath.replace('{model=models/*}', modelRefId.startsWith('models/') ? modelRefId : `models/${modelRefId}`);
  }
  return apiPath;
}


export function geminiAccess(access: GeminiAccessSchema, modelRefId: string | null, apiPath: string, useV1Alpha: boolean): { headers: HeadersInit, url: string } {

  const vertex = _resolveVertexMode(access);
  const defaultHost = access.geminiHost?.trim()
    ? access.geminiHost
    : vertex.hostDefault;
  const geminiHost = llmsFixupHost(defaultHost || DEFAULT_GEMINI_HOST, apiPath);

  // --- Vertex / Bearer path ---
  if (vertex.useVertex) {
    let path = apiPath;

    // CoT / alpha: Vertex uses v1; alpha features are not remapped here
    if (useV1Alpha)
      path = path.replaceAll('v1beta', 'v1alpha');

    path = _toVertexApiPath(path, vertex.projectId, vertex.location, modelRefId);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${vertex.bearerToken}`,
    };
    if (!access.clientSideFetch)
      headers['x-goog-api-client'] = `big-agi/${packageJson['version'] || '1.0.0'}`;

    return {
      headers,
      url: geminiHost + path,
    };
  }

  // --- Standard Gemini API key path ---
  let geminiKey = access.geminiKey || env.GEMINI_API_KEY || '';

  // multi-key with random selection - https://github.com/enricoros/big-AGI/issues/653
  geminiKey = llmsRandomKeyFromMultiKey(geminiKey);

  // validate key
  if (!geminiKey)
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Missing Gemini API Key (or set a Bearer token + project for Vertex AI / #1134)',
    });

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
