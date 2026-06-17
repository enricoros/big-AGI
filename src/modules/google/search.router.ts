import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { authedProcedure, createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { env } from '~/server/env.server';
import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import type { Search } from './search.types';
import { VERTEX_GROUNDING_REDIRECT_PREFIX } from './vertexai.types';


// configuration (Vertex AI grounding links)
const GROUNDING_MAX_URLS_PER_CALL = 64;
const GROUNDING_PER_URL_TIMEOUT_MS = 4000;


export const googleSearchRouter = createTRPCRouter({

  /**
   * Google Search via the Google Programmable Search product
   */
  search: publicProcedure
    .input(z.object({
      query: z.string(),
      items: z.number(),
      key: z.string().optional(), // could be server-set
      cx: z.string().optional(), // could be server-set
      restrictToDomain: z.string().nullable(),
    }))
    .query(async ({ input }): Promise<{ pages: Search.API.BriefResult[] }> => {

      const customSearchParams: Search.Wire.RequestParams = {
        q: input.query.trim(),
        cx: (input.cx || env.GOOGLE_CSE_ID || '').trim(),
        key: (input.key || env.GOOGLE_CLOUD_API_KEY || '').trim(),
        num: input.items,
      };

      // add domain restriction if provided
      if (input.restrictToDomain) {
        customSearchParams.siteSearch = input.restrictToDomain.trim();
        customSearchParams.siteSearchFilter = 'i'; // 'i' to include only these results (vs 'e' to exclude)
      }

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


  /// Vertex AI - grounding redirect links - https://github.com/enricoros/big-AGI/issues/1114 ///

  /**
   * Batch-resolves 'vertexaisearch.cloud.google.com/grounding-api-redirect/...' URLs (302 + Location).
   * Server-side because the redirect host sends no CORS headers, so a browser cannot read the Location header.
   * Failed/expired/timed-out links resolve to null and are kept as-is by the client.
   */
  resolveGroundingRedirects: authedProcedure
    .input(z.object({
      urls: z.array(z.string().startsWith(VERTEX_GROUNDING_REDIRECT_PREFIX)).min(1).max(GROUNDING_MAX_URLS_PER_CALL),
    }))
    .mutation(async ({ input }): Promise<{ resolutions: { url: string, resolved: string | null }[] }> => {
      const resolutions = await Promise.all(input.urls.map(async (url) => {
        try {
          const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(GROUNDING_PER_URL_TIMEOUT_MS) });
          const location = (response.status >= 300 && response.status < 400) ? response.headers.get('location') : null;
          return { url, resolved: location?.startsWith('http') ? location : null };
        } catch {
          return { url, resolved: null };
        }
      }));
      return { resolutions };
    }),

});


function objectToQueryString(params: Record<string, any>): string {
  return Object.entries(params)
    .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value))
    .join('&');
}