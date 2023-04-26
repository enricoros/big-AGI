import { OpenAI } from './openai.types';

if (!process.env.OPENAI_API_KEY)
  console.warn('OPENAI_API_KEY has not been provided in this deployment environment. Will need client-supplied keys, which is not recommended.');


/// OpenAI upstream API Helpers

function openAIHeaders(api: OpenAI.API.Configuration): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${api.apiKey}`,
    ...(api.apiOrganizationId && { 'OpenAI-Organization': api.apiOrganizationId }),
  };
}

async function rethrowOpenAIError(response: Response) {
  if (!response.ok) {
    let errorPayload: object | null = null;
    try {
      errorPayload = await response.json();
    } catch (e) {
      // ignore
    }
    throw new Error(`${response.status} · ${response.statusText}${errorPayload ? ' · ' + JSON.stringify(errorPayload) : ''}`);
  }
}

export async function openaiGet<TOut extends object>(api: OpenAI.API.Configuration, path: string): Promise<TOut> {
  const response = await fetch(`https://${api.apiHost}${path}`, {
    method: 'GET',
    headers: openAIHeaders(api),
  });
  await rethrowOpenAIError(response);
  return await response.json();
}

export async function openaiPostResponse<TBody extends object>(api: OpenAI.API.Configuration, path: string, body: TBody, signal?: AbortSignal,): Promise<Response> {
  const response = await fetch(`https://${api.apiHost}${path}`, {
    method: 'POST',
    headers: openAIHeaders(api),
    body: JSON.stringify(body),
    signal,
  });
  await rethrowOpenAIError(response);
  return response;
}

export async function openaiPost<TOut extends object, TBody extends object>(
  api: OpenAI.API.Configuration,
  apiPath: string,
  body: TBody,
  signal?: AbortSignal,
): Promise<TOut> {
  const response = await openaiPostResponse(api, apiPath, body, signal);
  return await response.json();
}


/// API <> Wire conversion helpers

export function toApiChatRequest(body: Partial<OpenAI.API.Chat.Request>): OpenAI.API.Chat.Request {
  // override with optional client configuration
  const api: OpenAI.API.Configuration = {
    apiKey: (body.api?.apiKey || process.env.OPENAI_API_KEY || '').trim(),
    apiHost: (body?.api?.apiHost || process.env.OPENAI_API_HOST || 'api.openai.com').trim().replaceAll('https://', ''),
    apiOrganizationId: (body.api?.apiOrganizationId || process.env.OPENAI_API_ORG_ID || '').trim(),
  };
  if (!api.apiKey) throw new Error('Missing OpenAI API Key. Add it on the client side (Settings icon) or server side (your deployment).');

  // require 'model' and 'messages' to be set
  const { model, messages, temperature = 0.5, max_tokens = 1024 } = body;
  if (!model || !messages) throw new Error('Missing required parameters: api, model, messages');

  return { api, model, messages, temperature, max_tokens };
}

export function toWireCompletionRequest(input: Omit<OpenAI.API.Chat.Request, 'api'>, stream: boolean): OpenAI.Wire.Chat.CompletionRequest {
  return {
    model: input.model,
    messages: input.messages,
    ...(input.temperature && { temperature: input.temperature }),
    ...(input.max_tokens && { max_tokens: input.max_tokens }),
    stream,
    n: 1,
  };
}
