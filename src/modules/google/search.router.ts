import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { env } from '~/server/env.mjs';
import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { Search } from './search.types';


const inputSchema = z.object({
  query: z.string(),
  key: z.string().optional(), // could be server-set
  cx: z.string().optional(), // could be server-set
});


export const googleSearchRouter = createTRPCRouter({

  /**
   * Google Search via the Google Programmable Search product
   */
  search: publicProcedure
    .input(inputSchema)
    .query(async ({ input }): Promise<{ pages: Search.API.BriefResult[] }> => {

      const customSearchParams: Search.Wire.RequestParams = {
        q: input.query.trim(),
        cx: (input.cx || env.GOOGLE_CSE_ID || '').trim(),
        key: (input.key || env.GOOGLE_CLOUD_API_KEY || '').trim(),
        num: 5,
      };

      if (!customSearchParams.key || !customSearchParams.cx)
        throw new Error('Missing API Key or Custom Search Engine ID');

      const url = `https://www.googleapis.com/customsearch/v1?${objectToQueryString(customSearchParams)}`;
      const data: Search.Wire.SearchResponse & { error?: { message?: string } } = await fetchJsonOrTRPCThrow({
        url,
        name: 'Google Custom Search',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'User-Agent': 'Big-AGI (gzip)',
        },
      });

      if (data.error)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Google Custom Search API error: ${data.error?.message}`,
        });

      return {
        pages: data.items?.map((result): Search.API.BriefResult => ({
          title: result.title,
          link: result.link,
          snippet: result.snippet,
        })) || [],
      };
    }),

});


function objectToQueryString(params: Record<string, any>): string {
  return Object.entries(params)
    .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value))
    .join('&');
}