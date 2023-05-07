import { NextRequest, NextResponse } from 'next/server';

import { Search } from '@/modules/search/search.types';
import { objectToQueryString } from '@/modules/search/search.client';


export default async function handler(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);

  const customSearchParams: Search.Wire.RequestParams = {
    q: searchParams.get('query') || '',
    cx: searchParams.get('cx') || process.env.GOOGLE_CSE_ID,
    key: searchParams.get('key') || process.env.GOOGLE_CLOUD_API_KEY,
    num: 5,
  };

  try {
    if (!customSearchParams.key || !customSearchParams.cx) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('Missing API Key or Custom Search Engine ID');
    }

    const wireResponse = await fetch(`https://www.googleapis.com/customsearch/v1?${objectToQueryString(customSearchParams)}`);
    const data: Search.Wire.SearchResponse & { error?: { message?: string } } = await wireResponse.json();

    if (data.error) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(`Google Custom Search API error: ${data.error?.message}`);
    }

    const apiResponse: Search.API.Response = data.items?.map((result): Search.API.BriefResult => ({
      title: result.title,
      link: result.link,
      snippet: result.snippet,
    })) || [];
    return new NextResponse(JSON.stringify(apiResponse));

  } catch (error: any) {
    console.error('api/search/google error:', error);
    return new NextResponse(`A search error occurred: ${error}`, { status: 500 });
  }
}

// noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};