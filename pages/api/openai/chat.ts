import { NextRequest, NextResponse } from 'next/server';

import { OpenAI } from '@/modules/openai/openai.types';
import { openaiPost, toApiChatRequest, toWireCompletionRequest } from '@/modules/openai/openai.server';




export default async function handler(req: NextRequest) {
  try {
    const requestBodyJson = await req.json();
    const { api, ...rest } = await toApiChatRequest(requestBodyJson);
    const upstreamRequest: OpenAI.Wire.Chat.CompletionRequest = toWireCompletionRequest(rest, false);
    const upstreamResponse: OpenAI.Wire.Chat.CompletionResponse = await openaiPost(api, '/v1/chat/completions', upstreamRequest);
    return new NextResponse(JSON.stringify({
      message: upstreamResponse.choices[0].message,
    } satisfies OpenAI.API.Chat.Response));
  } catch (error: any) {
    console.error('Fetch request failed:', error);
    return new NextResponse(`[Issue] ${error}`, { status: 400 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};