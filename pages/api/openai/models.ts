import { NextRequest, NextResponse } from 'next/server';

import { OpenAI } from '@/modules/openai/openai.types';
import { openaiGet } from '@/modules/openai/openai.server';

export default async function handler(req: NextRequest): Promise<NextResponse> {
  try {
    const api = {
      apiHost: (process.env.OPENAI_API_HOST || 'api.openai.com').trim().replaceAll('https://', ''),
      apiKey: (process.env.OPENAI_API_KEY || '').trim(),
      apiOrganizationId: (process.env.OPENAI_API_ORG_ID || '').trim(),
      heliconeKey: (process.env.HELICONE_API_KEY || '').trim(),
    };

    const wireModels = await openaiGet<OpenAI.Wire.Models.Response>(api, '/v1/models');

    // flatten IDs (most recent first)
    return new NextResponse(
      JSON.stringify({
        models: wireModels.data.map((model) => ({ id: model.id, created: model.created })),
      } satisfies OpenAI.API.Models.Response),
    );
  } catch (error: any) {
    console.error('api/openai/models error:', error);
    return new NextResponse(`[Issue] ${error}`, { status: 400 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};
