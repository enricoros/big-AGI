// Copyright (c) 2026 Enrico Ros
// News feed: the big-agi.com /api/app/v1/news stream, fetched directly from the browser.
// Deny by default: a request names the kinds it renders, the tier asking, and the preview channel.
// The v1 contract is frozen: fields never change, evolution is additive fields and new kinds.

import { useInfiniteQuery } from '@tanstack/react-query';
import * as z from 'zod/v4';

import { frontendSideFetch } from '~/common/util/clientFetchers';

import { NewsConfig } from './news.config';


/// Audience - who asks, per codeline (news.platform.ts)

export type NewsTier = 'open' | 'free' | 'pro';  // open-source builds, big-agi.com plans
export type NewsChannel = 'alpha';               // preview channel; stable when absent

export interface NewsAudience {
  off: boolean;                // the operator turned remote feeds off: no requests, What's New hidden
  tier: NewsTier;
  channel: NewsChannel | null;
}


/// Wire - GET /api/app/v1/news?kind=..&for=..&channel=..&before=..&limit=..
/// Mirrors the website's news.wire.ts; unknown fields are stripped, unknown kinds are dropped.

const _itemCore = {
  id: z.string(),
  date: z.string(),                                         // ISO day, the ordering key
  text: z.string(),                                         // mini-format: \n\n paragraphs, **bold**, [label](url) links, "- "/"1. " list lines
  for: z.array(z.enum(['open', 'free', 'pro'])).optional(), // absent = everyone
  channel: z.literal('alpha').optional(),                   // absent = stable
  areas: z.array(z.string()).optional(),
  models: z.array(z.string()).optional(),
  docs: z.array(z.string()).optional(),                     // docs slugs
  action: z.string().optional(),
};

const newsChangeSchema = z.object({
  ..._itemCore,
  kind: z.literal('change'),
});

const newsAnnouncementSchema = z.object({
  ..._itemCore,
  kind: z.literal('announcement'),
  title: z.string(),
  category: z.string().optional(),
  media: z.array(z.union([
    z.object({ type: z.literal('image'), src: z.string(), alt: z.string().optional() }),
    z.object({ type: z.literal('video'), provider: z.enum(['vimeo', 'youtube']), id: z.string() }),
  ])).optional(),
  url: z.string().optional(),
});

const newsItemSchema = z.discriminatedUnion('kind', [newsChangeSchema, newsAnnouncementSchema]);

const newsPageSchema = z.object({
  v: z.literal(1),
  items: z.array(z.unknown()), // validated one by one: a bad or unknown item never drops the page
  more: z.string().nullable(), // ISO day: next page's ?before=; null at the end
});

export type NewsChangeItem = z.infer<typeof newsChangeSchema>;
export type NewsAnnouncement = z.infer<typeof newsAnnouncementSchema>;
export type NewsItem = z.infer<typeof newsItemSchema>;

/** One changelog day, grouped client-side from change items (doc order within the day) */
export interface NewsChangelogGroup {
  date: string;
  items: NewsChangeItem[];
}


/// Query

// the kinds this build renders, sorted: part of the canonical URL
const _FEED_KINDS = NewsConfig.announcementsEnabled ? 'announcement,change' : 'change';

// one canonical URL per audience (fixed parameter order): every client shares the CDN entries
function _newsFeedUrl(tier: NewsTier, channel: NewsChannel | null, before: string | null): string {
  const params = [
    `kind=${_FEED_KINDS}`,
    `for=${tier}`,
    ...(channel ? [`channel=${channel}`] : []),
    ...(before ? [`before=${before}`] : []),
    `limit=${NewsConfig.feedPageLimit}`,
  ];
  return `${NewsConfig.feedBaseUrl}/news?${params.join('&')}`;
}

// Fetch one page and validate it - throws on HTTP or envelope mismatch (the query lands in error, surfaces hide)
async function _fetchNewsPage(url: string, signal?: AbortSignal): Promise<{ items: NewsItem[], more: string | null }> {
  const response = await frontendSideFetch(url, { signal });
  if (!response.ok)
    throw new Error(`News feed: HTTP ${response.status}`);
  const page = newsPageSchema.safeParse(await response.json());
  if (!page.success) {
    console.error('[news] invalid feed page:', page.error.issues);
    throw new Error('News feed: unexpected payload');
  }
  const items: NewsItem[] = [];
  for (const raw of page.data.items) {
    const item = newsItemSchema.safeParse(raw);
    if (item.success) {
      items.push(item.data);
      continue;
    }
    // kinds this build doesn't know are expected (forward compatibility); a malformed known kind is not
    const kind = (raw as { kind?: unknown } | null)?.kind;
    if (kind === 'change' || kind === 'announcement')
      console.warn('[news] dropped a malformed item:', item.error.issues);
  }
  return { items, more: page.data.more };
}


/**
 * The news stream, paged by the server's day cursor. Pages are cached by React Query and shared by
 * every surface with the same audience; `loadMore` fetches the next older page.
 */
export function useNewsFeed(enabled: boolean, tier: NewsTier, channel: NewsChannel | null) {
  const { data, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    enabled,
    queryKey: ['news-feed', 1, _newsFeedUrl(tier, channel, null)],
    queryFn: ({ pageParam, signal }) => _fetchNewsPage(_newsFeedUrl(tier, channel, pageParam), signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.more ?? undefined,
    staleTime: NewsConfig.feedStaleTimeMs,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  return {
    items: data?.pages.flatMap(page => page.items) ?? null, // null until the first page loads
    isError,
    hasMore: hasNextPage,
    loadMore: fetchNextPage,
    isLoadingMore: isFetchingNextPage,
  };
}

/** Change items -> days, in feed order */
export function newsGroupChanges(items: NewsItem[]): NewsChangelogGroup[] {
  const groups: NewsChangelogGroup[] = [];
  for (const item of items) {
    if (item.kind !== 'change') continue;
    const last = groups[groups.length - 1];
    if (last?.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}
