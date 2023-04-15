import { NextRequest, NextResponse } from 'next/server';

import { OpenAIAPI } from '@/types/api-openai';
import { extractOpenaiChatInputs, getOpenAIJson } from './chat';


type ApiModelIDInfo = { id: string; created: number };
export type ApiOpenAIModelsResponse = {
  models: ApiModelIDInfo[];
};

export default async function handler(req: NextRequest): Promise<NextResponse> {
  try {
    const { api } = await extractOpenaiChatInputs(req);

    // FIXME: this is currently broken, the "extractOpenAIChatInputs" is expecting messages/modelId, which we don't have here
    //        keep working on this

    const models = await getOpenAIJson<OpenAIAPI.Models.ModelList>(api, '/v1/models');

    // flatten IDs (most recent first)
    return new NextResponse(JSON.stringify({
      models: models.data.map((model) => ({ id: model.id, created: model.created })),
    } as ApiOpenAIModelsResponse));

  } catch (error: any) {
    console.error('Fetch request failed:', error);
    return new NextResponse(`[Issue] ${error}`, { status: 400 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};