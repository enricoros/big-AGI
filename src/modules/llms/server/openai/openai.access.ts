/**
 * Isomorphic OpenAI-compatible API access - works on both server and client.
 *
 * This module only imports zod for schema definition and provides access logic
 * that works identically on server and client environments.
 *
 * Supports 15 OpenAI-compatible dialects: alibaba, azure, deepseek, groq, lmstudio,
 * localai, mistral, moonshot, openai, openpipe, openrouter, perplexity, togetherai, xai, zai
 */

import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { BaseProduct } from '~/common/app.release';

import { env } from '~/server/env.server';

import type { RequestAccessValues } from '../llm.server.types';


// configuration
const DEFAULT_ALIBABA_HOST = 'https://dashscope-intl.aliyuncs.com/compatible-mode';
const DEFAULT_DEEPSEEK_HOST = 'https://api.deepseek.com';
const DEFAULT_GROQ_HOST = 'https://api.groq.com/openai';
const DEFAULT_HELICONE_OPENAI_HOST = 'oai.hconeai.com';
const DEFAULT_LMSTUDIO_HOST = 'http://localhost:1234';
const DEFAULT_LOCALAI_HOST = 'http://127.0.0.1:8080';
const DEFAULT_MISTRAL_HOST = 'https://api.mistral.ai';
const DEFAULT_MOONSHOT_HOST = 'https://api.moonshot.ai';
const DEFAULT_OPENAI_HOST = 'api.openai.com';
const DEFAULT_OPENPIPE_HOST = 'https://app.openpipe.ai/api';
const DEFAULT_OPENROUTER_HOST = 'https://openrouter.ai/api';
const DEFAULT_PERPLEXITY_HOST = 'https://api.perplexity.ai';
const DEFAULT_TOGETHERAI_HOST = 'https://api.together.xyz';
const DEFAULT_XAI_HOST = 'https://api.x.ai';
const DEFAULT_ZAI_HOST = 'https://api.z.ai/api/paas';


// -- Centralized OpenAI-compatible API Paths --
// These are the standard paths used across all OpenAI-compatible dialects.
// Some dialects (perplexity, cloudflare, azure) have custom path handling.
// Dialects with user-configurable hosts (lmstudio, localai, openai, ollama) support
// custom base paths - when the host URL contains a path, /v1 is stripped.

export const OPENAI_API_PATHS = {
  chatCompletions: '/v1/chat/completions',

  responses: '/v1/responses',

  models: '/v1/models',

  images: '/v1/images/generations',
  imageEdits: '/v1/images/edits',

  audioSpeech: '/v1/audio/speech',

  // xAI-specific (different models endpoint)
  xaiLanguageModels: '/v1/language-models',
} as const;


// --- Fixup Host (all accesses) ---

/** Add https if missing, and remove trailing slash if present and the path starts with a slash. */
export function llmsFixupHost(host: string, apiPath: string): string {
  if (!host)
    return '';
  if (!host.startsWith('http'))
    host = `https://${host}`;
  if (host.endsWith('/') && apiPath.startsWith('/'))
    host = host.slice(0, -1);
  return host;
}

/**
 * Safely check if a host URL's hostname matches the expected hostname.
 * This prevents DNS spoofing attacks where malicious hosts like "api.openai.com.evil.com"
 * would pass simple string `.includes()` checks.
 */
export function llmsHostnameMatches(hostUrl: string | undefined, expectedHostname: string): boolean {
  if (!hostUrl)
    return false;
  try {
    const url = new URL(hostUrl.startsWith('http') ? hostUrl : `https://${hostUrl}`);
    return url.hostname === expectedHostname;
  } catch {
    return false;
  }
}

/** Select a random key from a comma-separated list of API keys, used to load balance. */
export function llmsRandomKeyFromMultiKey(multiKeyString: string): string {
  if (!multiKeyString.includes(','))
    return multiKeyString;

  const multiKeys = multiKeyString
    .split(',')
    .map(key => key.trim())
    .filter(Boolean);

  if (!multiKeys.length)
    return '';

  return multiKeys[Math.floor(Math.random() * multiKeys.length)];
}


// --- OpenAI-Compatible Access ---

export type OpenAIDialects = OpenAIAccessSchema['dialect'];
export type OpenAIAccessSchema = z.infer<typeof openAIAccessSchema>;
export const openAIAccessSchema = z.object({
  dialect: z.enum([
    'alibaba', 'azure', 'deepseek', 'groq', 'lmstudio',
    'localai', 'mistral', 'moonshot', 'openai', 'openpipe',
    'openrouter', 'perplexity', 'togetherai', 'xai', 'zai',
  ]),
  clientSideFetch: z.boolean().optional(), // optional: backward compatibility from newer server version - can remove once all clients are updated
  oaiKey: z.string().trim(),
  oaiOrg: z.string().trim(), // [OpenPipe] we have a hack here, where we put the tags stringified JSON in here - cleanup in the future
  oaiHost: z.string().trim(),
  heliKey: z.string().trim(),

  // [OpenRouter only] Debug/routing service-level settings
  orRequireParameters: z.boolean().optional(), // Only route to providers supporting all request params
});

export function openAIAccess(access: OpenAIAccessSchema, modelRefId: string | null, apiPath: string): { headers: HeadersInit, url: string } {
  switch (access.dialect) {

    case 'alibaba':
      let alibabaOaiKey = access.oaiKey || env.ALIBABA_API_KEY || '';
      const alibabaOaiHost = llmsFixupHost(access.oaiHost || env.ALIBABA_API_HOST || DEFAULT_ALIBABA_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      alibabaOaiKey = llmsRandomKeyFromMultiKey(alibabaOaiKey);

      if (!alibabaOaiKey || !alibabaOaiHost)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Alibaba API Key. Add it on the UI or server side (your deployment).' });

      return {
        headers: {
          'Authorization': `Bearer ${alibabaOaiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        url: alibabaOaiHost + apiPath,
      };

    case 'azure':
      return _azureOpenAIAccess(access, modelRefId, apiPath);

    case 'deepseek':
      // https://platform.deepseek.com/api-docs/
      let deepseekKey = access.oaiKey || env.DEEPSEEK_API_KEY || '';
      const deepseekHost = llmsFixupHost(access.oaiHost || DEFAULT_DEEPSEEK_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      deepseekKey = llmsRandomKeyFromMultiKey(deepseekKey);

      if (!deepseekKey || !deepseekHost)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Deepseek API Key or Host. Add it on the UI (Models Setup) or server side (your deployment).' });

      return {
        headers: {
          'Authorization': `Bearer ${deepseekKey}`,
          'Content-Type': 'application/json',
        },
        url: deepseekHost + apiPath,
      };

    case 'groq':
      let groqKey = access.oaiKey || env.GROQ_API_KEY || '';
      const groqHost = llmsFixupHost(access.oaiHost || DEFAULT_GROQ_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      groqKey = llmsRandomKeyFromMultiKey(groqKey);

      if (!groqKey)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Groq API Key. Add it on the UI (Models Setup) or server side (your deployment).' });

      return {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        url: groqHost + apiPath,
      };

    case 'lmstudio':
      const lmsAIKey = access.oaiKey || '';
      let lmsAIHost = llmsFixupHost(access.oaiHost || DEFAULT_LMSTUDIO_HOST, apiPath);
      return {
        headers: {
          'Content-Type': 'application/json',
          ...(lmsAIKey && { Authorization: `Bearer ${lmsAIKey}` }),
        },
        url: lmsAIHost + apiPath,
      };

    case 'localai':
      const localAIKey = access.oaiKey || env.LOCALAI_API_KEY || '';
      let localAIHost = llmsFixupHost(access.oaiHost || env.LOCALAI_API_HOST || DEFAULT_LOCALAI_HOST, apiPath);
      return {
        headers: {
          'Content-Type': 'application/json',
          ...(localAIKey && { Authorization: `Bearer ${localAIKey}` }),
        },
        url: localAIHost + apiPath,
      };

    case 'mistral':
      // https://docs.mistral.ai/platform/client
      let mistralKey = access.oaiKey || env.MISTRAL_API_KEY || '';
      const mistralHost = llmsFixupHost(access.oaiHost || DEFAULT_MISTRAL_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      mistralKey = llmsRandomKeyFromMultiKey(mistralKey);

      return {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${mistralKey}`,
        },
        url: mistralHost + apiPath,
      };

    case 'moonshot':
      // https://platform.moonshot.ai/docs/api/chat
      let moonshotKey = access.oaiKey || env.MOONSHOT_API_KEY || '';
      const moonshotHost = llmsFixupHost(access.oaiHost || DEFAULT_MOONSHOT_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      moonshotKey = llmsRandomKeyFromMultiKey(moonshotKey);

      if (!moonshotKey || !moonshotHost)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Moonshot API Key or Host. Add it on the UI or server side.' });

      return {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${moonshotKey}`,
        },
        url: moonshotHost + apiPath,
      };

    case 'openai': {

      // Credential resolution: client-dominated
      // - if the client provides a host, they own the whole request - no server
      // - credentials (API key, org, Helicone key) are sent to client-chosen endpoints
      // - if the client doesn't set a host, they can still override the key (own billing).
      let oaiKey: string;
      let oaiHost: string;
      let oaiOrg: string;
      let heliKey: string | false;
      if (access.oaiHost) {
        // Client controls the endpoint: only client credentials
        oaiKey = access.oaiKey || '';
        oaiHost = access.oaiHost;
        oaiOrg = access.oaiOrg || '';
        heliKey = access.heliKey || false;
      } else {
        // Client hasn't touched the endpoint: server infrastructure
        oaiKey = access.oaiKey || env.OPENAI_API_KEY || '';
        oaiHost = /* NO access.oaiHost */ env.OPENAI_API_HOST || DEFAULT_OPENAI_HOST;
        oaiOrg = access.oaiOrg || env.OPENAI_API_ORG_ID || '';
        heliKey = access.heliKey || env.HELICONE_API_KEY || false;
      }

      oaiHost = llmsFixupHost(oaiHost, apiPath);

      // Require a key when targeting the default OpenAI host
      if (!oaiKey && llmsHostnameMatches(oaiHost, DEFAULT_OPENAI_HOST))
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing OpenAI API Key. Add it on the UI or server side (your deployment).' });

      // [Helicone] proxy: redirect default OpenAI host to Helicone when key present;
      // if host is already Helicone keep it; for any other host, disable the Helicone key
      if (heliKey) {
        if (llmsHostnameMatches(oaiHost, DEFAULT_OPENAI_HOST))
          oaiHost = `https://${DEFAULT_HELICONE_OPENAI_HOST}`;
        else if (!llmsHostnameMatches(oaiHost, DEFAULT_HELICONE_OPENAI_HOST))
          heliKey = false;
      }

      // [Cloudflare AI Gateway] proxy: adapt API paths for Cloudflare's routing
      if (llmsHostnameMatches(oaiHost, 'gateway.ai.cloudflare.com')) {
        const parsedUrl = new URL(oaiHost);
        const pathSegments = parsedUrl.pathname.split('/').filter(segment => segment.length > 0);

        // Expected: /v1/<ACCOUNT_TAG>/<GATEWAY_URL_SLUG>/<PROVIDER_ENDPOINT>
        if (pathSegments.length < 3 || pathSegments.length > 4 || pathSegments[0] !== 'v1')
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cloudflare AI Gateway API Host is not valid. Please check the API Host field in the Models Setup page.' });

        const [_v1, accountTag, gatewayName, provider] = pathSegments;
        if (provider && provider !== 'openai')
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cloudflare AI Gateway only supports OpenAI as a provider.' });

        if (apiPath.startsWith('/v1'))
          apiPath = apiPath.replace('/v1', '');

        oaiHost = 'https://gateway.ai.cloudflare.com';
        apiPath = `/v1/${accountTag}/${gatewayName}/${provider || 'openai'}${apiPath}`;
      }

      return {
        headers: {
          'Content-Type': 'application/json',
          ...(oaiKey && { Authorization: `Bearer ${oaiKey}` }),
          ...(oaiOrg && { 'OpenAI-Organization': oaiOrg }),
          ...(heliKey && { 'Helicone-Auth': `Bearer ${heliKey}` }),
        },
        url: oaiHost + apiPath,
      };
    }

    case 'openpipe':
      const openPipeKey = access.oaiKey || env.OPENPIPE_API_KEY || '';
      if (!openPipeKey)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing OpenPipe API Key or Host. Add it on the UI or server side (your deployment).' });

      return {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openPipeKey}`,
          'op-log-request': 'true',
          ...(access.oaiOrg && { 'op-tags': access.oaiOrg }),
        },
        url: llmsFixupHost(DEFAULT_OPENPIPE_HOST, apiPath) + apiPath,
      };

    case 'openrouter':
      let orKey = access.oaiKey || env.OPENROUTER_API_KEY || '';
      const orHost = llmsFixupHost(access.oaiHost || DEFAULT_OPENROUTER_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      orKey = llmsRandomKeyFromMultiKey(orKey);

      if (!orKey || !orHost)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing OpenRouter API Key or Host. Add it on the UI or server side (your deployment).' });

      return {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orKey}`,
          'HTTP-Referer': BaseProduct.ProductURL,
          'X-Title': BaseProduct.ProductName,
        },
        url: orHost + apiPath,
      };

    case 'perplexity':
      let perplexityKey = access.oaiKey || env.PERPLEXITY_API_KEY || '';
      const perplexityHost = llmsFixupHost(access.oaiHost || DEFAULT_PERPLEXITY_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      perplexityKey = llmsRandomKeyFromMultiKey(perplexityKey);

      if (!perplexityKey || !perplexityHost)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Perplexity API Key or Host. Add it on the UI (Models Setup) or server side (your deployment).' });

      if (apiPath.startsWith('/v1'))
        apiPath = apiPath.replace('/v1', '');

      return {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${perplexityKey}`,
        },
        url: perplexityHost + apiPath,
      };

    case 'togetherai':
      let togetherKey = access.oaiKey || env.TOGETHERAI_API_KEY || '';
      const togetherHost = llmsFixupHost(access.oaiHost || DEFAULT_TOGETHERAI_HOST, apiPath);

      // Use function to select a random key if multiple keys are provided
      togetherKey = llmsRandomKeyFromMultiKey(togetherKey);

      if (!togetherKey || !togetherHost)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing TogetherAI API Key or Host. Add it on the UI (Models Setup) or server side (your deployment).' });

      return {
        headers: {
          'Authorization': `Bearer ${togetherKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        url: togetherHost + apiPath,
      };

    case 'xai':
      let xaiKey = access.oaiKey || env.XAI_API_KEY || '';

      // Use function to select a random key if multiple keys are provided
      xaiKey = llmsRandomKeyFromMultiKey(xaiKey);

      if (!xaiKey)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing xAI API Key. Add it on the UI (Models Setup) or server side (your deployment).' });

      return {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${xaiKey}`,
        },
        url: DEFAULT_XAI_HOST + apiPath,
      };

    case 'zai':
      // Z.ai uses /paas/v4/ instead of standard /v1/, the HOST contains up to /api/paas, then we remap /v1 -> /v4
      let zaiKey = access.oaiKey || '';
      const zaiHost = llmsFixupHost(access.oaiHost || DEFAULT_ZAI_HOST, apiPath);
      const zaiPath = apiPath.replace('/v1', '/v4');

      zaiKey = llmsRandomKeyFromMultiKey(zaiKey);
      if (!zaiKey || !zaiHost)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Z.ai API Key or Host. Add it on the UI (Models Setup) or server side (your deployment).' });

      return {
        headers: {
          'Authorization': `Bearer ${zaiKey}`,
          'Content-Type': 'application/json',
        },
        url: zaiHost + zaiPath,
      };

  }
}

function _azureServerSideVars() {
  return {
    apiKey: env.AZURE_OPENAI_API_KEY || '',
    apiEndpoint: env.AZURE_OPENAI_API_ENDPOINT || '',
    // 'v1' is the next-gen API, which doesn't have a monthly version string anymore
    apiEnableV1: env.AZURE_OPENAI_DISABLE_V1 !== 'true',
    // https://learn.microsoft.com/en-us/azure/ai-foundry/openai/api-version-lifecycle?tabs=key
    versionAzureOpenAI: env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview',
    // old-school API used to list deployments - still needed for listing models, as even /v1/models would list any model available on azure and not just the deployed ones
    versionDeployments: env.AZURE_DEPLOYMENTS_API_VERSION || '2023-03-15-preview',
  };
}

function _azureOpenAIAccess(access: OpenAIAccessSchema, modelRefId: string | null, apiPath: string): RequestAccessValues {

  // Server-side configuration, with defaults
  const server = _azureServerSideVars();

  // Client-provided values always take precedence over server env vars
  const azureKey = access.oaiKey || server.apiKey || '';
  const azureHostFixed = llmsFixupHost(access.oaiHost || server.apiEndpoint || '', apiPath);

  // Normalize to origin only (discard path/query) to prevent malformed URLs
  let azureBase: string;
  try {
    azureBase = new URL(azureHostFixed).origin;
  } catch (e) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `Azure OpenAI API Host is invalid: ${azureHostFixed || 'missing'}` });
  }

  if (!azureKey || !azureBase)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing Azure API Key or Host. Add it on the UI (Models Setup) or server side (your deployment).' });

  /**
   * Azure OpenAI API Routing: Convert OpenAI standard paths to Azure-specific paths
   *
   * Azure supports two API patterns:
   * 1. Next-gen v1 API (/openai/v1/...): Direct endpoints without deployment IDs
   *    - Used for GPT-5-like models with advanced features
   *    - Enabled by default, can be disabled via AZURE_OPENAI_DISABLE_V1=true
   * 2. Traditional deployment-based API (/openai/deployments/{id}/...): Legacy pattern
   *    - Required for older models and when v1 API is disabled
   *    - Requires deployment ID for all API calls
   */
  switch (true) {

    // List models
    case apiPath === OPENAI_API_PATHS.models:
      // uses the good old Azure OpenAI Deployments listing API
      apiPath = `/openai/deployments?api-version=${server.versionDeployments}`;
      break;

    // Responses API - next-gen v1 API
    case apiPath === OPENAI_API_PATHS.responses && server.apiEnableV1:
      // Next-gen v1 API: direct endpoint without deployment path
      apiPath = '/openai/v1/responses'; // NOTE: we seem to not need the api-version query param here
      // apiPath = `/openai/v1/responses?api-version=${server.versionResponses}`;
      // console.log('[Azure] Using next-gen v1 API for Responses:', apiPath);
      break;

    // Chat Completions API, and other v1 APIs
    case apiPath === OPENAI_API_PATHS.chatCompletions
    || apiPath === OPENAI_API_PATHS.responses
    || apiPath.startsWith('/v1/'): // all the other /v1/ paths, like images, audio, etc.

      // require the model Id for traditional deployment-based routing
      if (!modelRefId)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Azure OpenAI API needs a deployment id' });

      const functionName = apiPath.replace('/v1/', ''); // e.g. 'chat/completions'
      apiPath = `/openai/deployments/${modelRefId}/${functionName}?api-version=${server.versionAzureOpenAI}`;
      break;

    default:
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Azure OpenAI API path not supported: ' + apiPath });
  }

  return {
    headers: {
      'Content-Type': 'application/json',
      'api-key': azureKey,
    },
    url: azureBase + apiPath,
  };
}
