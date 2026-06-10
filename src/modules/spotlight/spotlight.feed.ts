// Copyright (c) 2026 Enrico Ros
// Spotlight Feed: remote news for the Spotlight subsystem (announcements, changelog),
// served by the big-agi.com App News API and fetched directly from the browser.
// The v1 contracts are frozen: fields never change, server evolution is additive-only.

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { frontendSideFetch } from '~/common/util/clientFetchers';


// configuration
const FEED_API_BASE = 'https://big-agi.com/api/app/v1'; // canonical apex host (www redirects here), fixed address for all deployments
const FEED_STALE_TIME = 15 * 60 * 1000; // news doesn't move fast - no reason to refetch more often


/// Changelog - GET /api/app/v1/changelog
/// Frozen v1 contract: fields never change, server evolution is additive-only (unknown keys stripped here)

const changelogGroupSchema = z.object({
  date: z.string().nullable(),      // ISO day "2026-06-02" or null
  label: z.string(),                // display label, e.g. "Jun 2"
  year: z.number(),
  items: z.array(z.string()),       // plain text, **bold** markers only, never HTML
});

const changelogResponseSchema = z.object({
  v: z.literal(1),
  generatedAt: z.string(),          // ISO timestamp of content generation
  groups: z.array(changelogGroupSchema),
});

export type SpotlightFeedChangelogGroup = z.infer<typeof changelogGroupSchema>;


/// Announcements - GET /api/app/v1/announcements?tier=open|free|pro
/// Same contract rules; `id` is stable forever and keys mark-as-seen (Spotlight seen-store integration)

// who is asking - the server only returns entries whose audience includes this tier
export type SpotlightFeedTier = 'open' | 'free' | 'pro';

const announcementSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string().nullable(),      // ISO day "2026-03-12" or null
  category: z.string().nullable(),  // open set, convention: launch | upgrade | tip
  // additive v1 field (2026-06): must stay .optional() - servers and clients deploy independently
  audience: z.array(z.string()).nullable().optional(), // tiers this entry is for - null/absent = everyone (pre-filtered server-side)
  vimeoId: z.string().nullable(),
  imageUrls: z.array(z.string()),   // https image URLs, render-ready from any origin
  url: z.string().nullable(),       // learn-more link
  body: z.string().nullable(),      // mini-format: \n\n paragraphs, **bold**, [label](url) links, "- "/"1. " list lines
});

const announcementsResponseSchema = z.object({
  v: z.literal(1),
  generatedAt: z.string(),
  announcements: z.array(announcementSchema),
});

export type SpotlightFeedAnnouncement = z.infer<typeof announcementSchema>;


// Fetch a feed endpoint and validate the payload - throws on HTTP or contract mismatch,
// so the query lands in error state and consumers hide the surface
async function _fetchFeedApi<TSchema extends z.ZodType>(path: string, schema: TSchema, signal?: AbortSignal): Promise<z.infer<TSchema>> {
  const response = await frontendSideFetch(FEED_API_BASE + path, { signal });
  if (!response.ok)
    throw new Error(`Spotlight feed: HTTP ${response.status}`);
  const validated = schema.safeParse(await response.json());
  if (!validated.success) {
    console.error(`[spotlight] invalid feed payload from ${path}:`, validated.error.issues);
    throw new Error('Spotlight feed: unexpected payload');
  }
  return validated.data;
}


/**
 * Latest changelog date groups from big-agi.com - empty/error means hide the surface.
 */
export function useSpotlightFeedChangelog(enabled: boolean = true) {
  const { data, isLoading, isError } = useQuery({
    enabled,
    queryKey: ['spotlight-feed', 'changelog', 1],
    queryFn: async ({ signal }) => _fetchFeedApi('/changelog', changelogResponseSchema, signal),
    staleTime: FEED_STALE_TIME,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  return {
    changelogGroups: data?.groups ?? null, // null until loaded
    isLoading,
    isError,
  };
}

/**
 * In-app announcements (feature spotlights) from big-agi.com - empty/error means hide the surface.
 * `tier` declares this deployment/user: 'open' (default, self-host builds), 'free' or 'pro' (hosted).
 */
export function useSpotlightFeedAnnouncements(enabled: boolean = true, tier: SpotlightFeedTier) {
  const { data, isLoading, isError } = useQuery({
    enabled,
    queryKey: ['spotlight-feed', 'announcements', 1, tier],
    queryFn: async ({ signal }) => _fetchFeedApi(`/announcements?tier=${tier}`, announcementsResponseSchema, signal),
    staleTime: FEED_STALE_TIME,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  return {
    announcements: data?.announcements ?? null, // null until loaded
    isLoading,
    isError,
  };
}
