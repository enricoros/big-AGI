import { NextRequest, NextResponse } from 'next/server';

import { OpenAIAPI } from '@/types/api-openai';


if (!process.env.OPENAI_API_KEY)
  console.warn(
    'OPENAI_API_KEY has not been provided in this deployment environment. ' +
    'Will use the optional keys incoming from the client, which is not recommended.',
  );


// helper functions

export async function extractOpenaiChatInputs(req: NextRequest): Promise<ApiChatInput> {
  const {
    api: userApi = {},
    model,
    messages,
    temperature = 0.5,
    max_tokens = 1024,
  } = (await req.json()) as Partial<ApiChatInput>;
  if (!model || !messages)
    throw new Error('Missing required parameters: api, model, messages');

  const api: OpenAIAPI.Configuration = {
    apiKey: (userApi.apiKey || process.env.OPENAI_API_KEY || '').trim(),
    apiHost: (userApi.apiHost || process.env.OPENAI_API_HOST || 'api.openai.com').trim().replaceAll('https://', ''),
    apiOrganizationId: (userApi.apiOrganizationId || process.env.OPENAI_API_ORG_ID || '').trim(),
  };
  if (!api.apiKey)
    throw new Error('Missing OpenAI API Key. Add it on the client side (Settings icon) or server side (your deployment).');

  return { api, model, messages, temperature, max_tokens };
}

const openAIHeaders = (api: OpenAIAPI.Configuration): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${api.apiKey}`,
  ...(api.apiOrganizationId && { 'OpenAI-Organization': api.apiOrganizationId }),
});

export const chatCompletionPayload = (input: Omit<ApiChatInput, 'api'>, stream: boolean): OpenAIAPI.Chat.CompletionsRequest => ({
  model: input.model,
  messages: input.messages,
  ...(input.temperature && { temperature: input.temperature }),
  ...(input.max_tokens && { max_tokens: input.max_tokens }),
  stream,
  n: 1,
});

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

export async function getOpenAIJson<TJson extends object>(api: OpenAIAPI.Configuration, apiPath: string): Promise<TJson> {
  const response = await fetch(`https://${api.apiHost}${apiPath}`, {
    method: 'GET',
    headers: openAIHeaders(api),
  });
  await rethrowOpenAIError(response);
  return await response.json();
}

export async function postToOpenAI<TBody extends object>(api: OpenAIAPI.Configuration, apiPath: string, body: TBody, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(`https://${api.apiHost}${apiPath}`, {
    method: 'POST',
    headers: openAIHeaders(api),
    body: JSON.stringify(body),
    signal,
  });
  await rethrowOpenAIError(response);
  return response;
}


// I/O types for this endpoint

export interface ApiChatInput {
  api: OpenAIAPI.Configuration;
  model: string;
  messages: OpenAIAPI.Chat.Message[];
  temperature?: number;
  max_tokens?: number;
}

export interface ApiChatResponse {
  message: OpenAIAPI.Chat.Message;
}

export default async function handler(req: NextRequest) {
  try {
    const { api, ...rest } = await extractOpenaiChatInputs(req);
    const response = await postToOpenAI(api, '/v1/chat/completions', chatCompletionPayload(rest, false));
    const completion: OpenAIAPI.Chat.CompletionsResponse = await response.json();
    return new NextResponse(JSON.stringify({
      message: completion.choices[0].message,
    } as ApiChatResponse));
  } catch (error: any) {
    console.error('Fetch request failed:', error);
    return new NextResponse(`[Issue] ${error}`, { status: 400 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};