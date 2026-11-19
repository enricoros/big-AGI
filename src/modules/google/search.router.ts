import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { authedProcedure, createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';
import { env } from '~/server/env.server';

import type { WebSearchResult } from '~/modules/websearch/search.types';

import type { Search } from './search.types';
import type { VertexLinkResolution } from './vertexai.types';
import { VERTEX_GROUNDING_REDIRECT_PREFIX } from './vertexai.types';


// configuration (Vertex AI grounding links)
const GROUNDING_MAX_URLS_PER_CALL = 64;
const GROUNDING_DEFAULT_DEADLINE_MS = 4000;
const GROUNDING_MAX_DEADLINE_MS = 8000;


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
    .query(async ({ input, ctx }): Promise<{ pages: WebSearchResult[] }> => {

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
      let data: Search.Wire.SearchResponse & { error?: unknown };
      try {
        // Google errors can echo the query-string key; never log or relay their payloads.
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'User-Agent': 'Big-AGI (gzip)',
          },
          signal: ctx.reqSignal,
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new TRPCError({ code: 'BAD_GATEWAY', message: `Google Custom Search failed (HTTP ${response.status}).` });
        }
        data = await response.json();
        if (data.error)
          throw new TRPCError({ code: 'BAD_GATEWAY', message: 'Google Custom Search rejected the request.' });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: ctx.reqSignal.aborted ? 'CLIENT_CLOSED_REQUEST' : 'BAD_GATEWAY', message: 'Google Custom Search could not complete the request.' });
      }

      return {
        pages: data.items?.map((result): WebSearchResult => ({
          title: result.title,
          link: result.link,
          snippet: result.snippet,
        })) || [],
      };
    }),


  /// Vertex AI - grounding redirect links - https://github.com/enricoros/big-AGI/issues/1114 ///

  /**
   * Batch-resolves grounding redirect links: the redirect host sends no CORS headers, so only a server can read the Location.
   * One deadline per call: links without an answer by then come back 'unknown', for the client to ask again.
   */
  resolveGroundingRedirects: authedProcedure
    .input(z.object({
      urls: z.array(z.string().startsWith(VERTEX_GROUNDING_REDIRECT_PREFIX)).min(1).max(GROUNDING_MAX_URLS_PER_CALL),
      deadlineMs: z.number().int().max(GROUNDING_MAX_DEADLINE_MS).optional(),
    }))
    .mutation(async ({ input }) => {
      const startMs = Date.now();
      const signal = AbortSignal.timeout(input.deadlineMs ?? GROUNDING_DEFAULT_DEADLINE_MS);
      const resolutions = await Promise.all(input.urls.map(async (url): Promise<VertexLinkResolution> => {
        try {
          const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal });
          const location = response.headers.get('location');
          if (response.status >= 300 && response.status < 400 && location?.startsWith('http'))
            return { url, outcome: 'resolved', resolved: location };
          return { url, outcome: response.status === 404 || response.status === 410 ? 'dead' : 'unknown', reason: `HTTP ${response.status}` };
        } catch (error) {
          return { url, outcome: 'unknown', reason: signal.aborted ? 'no answer in time' : String((error instanceof Error && error.cause) || error) };
        }
      }));

      // server log: why links did not resolve, by reason
      const reasons: Record<string, number> = {};
      for (const answer of resolutions) {
        if (answer.outcome === 'resolved') continue;
        const reason = `${answer.outcome}: ${answer.reason}`;
        reasons[reason] = (reasons[reason] ?? 0) + 1;
      }
      if (Object.keys(reasons).length)
        console.log(`[Vertex AI links] unresolved in ${Date.now() - startMs}ms, of ${input.urls.length}:`, reasons);

      return { resolutions };
    }),

});


function objectToQueryString(params: Record<string, any>): string {
  return Object.entries(params)
    .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value))
    .join('&');
}