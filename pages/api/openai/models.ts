import { NextResponse } from 'next/server';


// definition for OpenAI wire types

namespace OpenAIAPI.Models {
  interface Model {
    id: string;
    object: 'model';
    created: number;
    owned_by: 'openai' | 'openai-dev' | 'openai-internal' | 'system' | string;
    permission: any[];
    root: string;
    parent: null;
  }

  export interface ModelList {
    object: string;
    data: Model[];
  }
}

async function fetchOpenAIModels(apiKey: string, apiHost: string): Promise<OpenAIAPI.Models.ModelList> {
  const response = await fetch(`https://${apiHost}/v1/models`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) throw new Error(`Failed to fetch /models: ${response.status} ${response.statusText}`);

  return await response.json();
}


type ApiModelIDInfo = { id: string; created: number };
export type ApiOpenAIModelsResponse = {
  models: ApiModelIDInfo[];
};

export default async function handler(): Promise<NextResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  const apiHost = process.env.OPENAI_API_HOST || 'api.openai.com';

  if (!apiKey) {
    return new NextResponse('[Issue] missing OpenAI API Key. Add it on the server side (your deployment).', { status: 400 });
  }

  try {
    const models: OpenAIAPI.Models.ModelList = await fetchOpenAIModels(apiKey, apiHost);

    // flatten IDs (most recent first)
    models.data.sort((a, b) => b.created - a.created);
    const response: ApiOpenAIModelsResponse = {
      models: models.data.map((model) => ({ id: model.id, created: model.created })),
    };

    return new NextResponse(JSON.stringify(response));
  } catch (error) {
    return new NextResponse('[Issue] Failed to fetch models.', { status: 500 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};
