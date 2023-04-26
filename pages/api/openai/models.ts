import { NextRequest, NextResponse } from 'next/server';

import { OpenAI } from '@/modules/openai/openai.types';
import { openaiGet, toApiChatRequest } from '@/modules/openai/openai.server';


export default async function handler(req: NextRequest): Promise<NextResponse> {
  try {
    // FIXME: this is currently broken, the "extractOpenAIChatInputs" is expecting messages/modelId, which we don't have here
    //        keep working on this
    const requestBodyJson = await req.json();
    const { api } = await toApiChatRequest(requestBodyJson);

    const wireModels = await openaiGet<OpenAI.Wire.Models.Response>(api, '/v1/models');

    // flatten IDs (most recent first)
    return new NextResponse(JSON.stringify({
      models: wireModels.data.map((model) => ({ id: model.id, created: model.created })),
    } satisfies OpenAI.API.Models.Response));

  } catch (error: any) {
    console.error('Fetch request failed:', error);
    return new NextResponse(`[Issue] ${error}`, { status: 400 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};