import * as z from 'zod/v4';
import { TRPCError } from '@trpc/server';

import { env } from '~/server/env.server';
import { createTRPCRouter, publicProcedure } from '~/server/trpc/trpc.server';

import type { WebSearchResult } from './search.types';

import { isValidContextSearchDomain } from './search.validation';


const responseSchema = z.object({
  partial: z.boolean().optional(),
  results: z.array(z.object({
    title: z.string(),
    url: z.url({ protocol: /^https?$/ }),
    description: z.string().nullish(),
    highlights: z.object({
      code: z.enum(['SUCCESS', 'NOT_REQUESTED', 'TIMEOUT', 'CONTENT_TOO_LARGE', 'WEBSITE_ACCESS_ERROR', 'WEBSITE_BLOCKED', 'ERROR']),
      highlights: z.array(z.string()).nullable(),
    }).optional(),
  })),
});

export const contextSearchRouter = createTRPCRouter({
  search: publicProcedure
    .input(z.object({
      query: z.string().trim().min(1).max(500),
      items: z.number().int().min(1).max(100),
      key: z.string().optional(),
      restrictToDomain: z.string().trim().refine(isValidContextSearchDomain, 'Enter a domain, such as example.com').nullable(),
    }))
    .mutation(async ({ input, ctx }): Promise<{ pages: WebSearchResult[], warning?: string }> => {
      const key = input.key?.trim() || env.CONTEXT_DEV_API_KEY?.trim();
      if (!key)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Configure a Context.dev API key in Tools > Custom Search.' });

      if (ctx.reqSignal.aborted)
        throw new TRPCError({ code: 'CLIENT_CLOSED_REQUEST', message: 'Context.dev search cancelled.' });
      const abortController = new AbortController();
      const { signal } = abortController;
      const onAbort = () => abortController.abort();
      const timeout = setTimeout(onAbort, 20_000);
      ctx.reqSignal.addEventListener('abort', onAbort, { once: true });
      try {
        // Keep credentials out of URLs and upstream error bodies out of application logs.
        const response = await fetch('https://api.context.dev/v1/web/search', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: input.query,
            numResults: input.items,
            highlightsOptions: { enabled: true, maxCharacters: 1000 },
            timeoutOpts: { milliseconds: 15_000, behavior: 'return-partial' },
            ...(input.restrictToDomain ? { includeDomains: [input.restrictToDomain] } : {}),
          }),
          signal,
        });
        if (!response.ok) {
          await response.body?.cancel();
          const reason = response.status === 401 ? 'Invalid Context.dev API key.'
            : response.status === 403 ? 'Context.dev access denied. Check your API key permissions.'
              : response.status === 402 ? 'Context.dev credits are exhausted. Check your account balance.'
                : response.status === 429 ? 'Context.dev rate limit reached. Try again later.'
                  : response.status >= 500 ? 'Context.dev is temporarily unavailable. Try again later.'
                    : 'Context.dev rejected the search request.';
          throw new TRPCError({ code: 'BAD_GATEWAY', message: `${reason} (HTTP ${response.status})` });
        }
        const parsed = responseSchema.safeParse(await response.json());
        if (!parsed.success)
          throw new TRPCError({ code: 'BAD_GATEWAY', message: 'Context.dev returned an invalid search response.' });
        return {
          pages: parsed.data.results.slice(0, input.items).map(result => {
            const highlights = result.highlights?.code === 'SUCCESS' ? result.highlights.highlights?.join('\n').trim() : '';
            return {
              title: result.title, link: result.url,
              snippet: highlights || `[Highlights unavailable; search description only.] ${result.description ?? ''}`,
            };
          }),
          ...(parsed.data.partial && { warning: 'Context.dev returned partial search results; some sources may be missing.' }),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (ctx.reqSignal.aborted)
          throw new TRPCError({ code: 'CLIENT_CLOSED_REQUEST', message: 'Context.dev search cancelled.' });
        if (signal.aborted)
          throw new TRPCError({ code: 'TIMEOUT', message: 'Context.dev search timed out. Try again.' });
        if (error instanceof SyntaxError)
          throw new TRPCError({ code: 'BAD_GATEWAY', message: 'Context.dev returned an invalid search response.' });
        throw new TRPCError({ code: 'BAD_GATEWAY', message: 'Could not connect to Context.dev. Try again.' });
      } finally {
        clearTimeout(timeout);
        ctx.reqSignal.removeEventListener('abort', onAbort);
      }
    }),
});
