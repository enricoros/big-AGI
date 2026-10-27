// Copyright (c) 2026 Enrico Ros
// News: What's New (the changelog, announcements, the per-user seen index) and the docs reader, both
// rendered from what big-agi.com publishes. Every UX parameter and limit of the module lives here.

import type { SiteDocSlug } from '~/common/gen/com.site.docs.slug';


export const NewsConfig = {

  // the website's app API (the news feed, the docs index): one fixed public address for every deployment (open, hosted, self-hosted)
  apiBaseUrl: 'https://big-agi.com/api/app/v1', // canonical apex host (www redirects here)

  // feed
  feedStaleTimeMs: 15 * 60 * 1000,   // mirrors the feed's CDN s-maxage
  feedPageLimit: 10 as 10 | 20 | 50, // items per page, whole days; older pages load on request ('Show earlier days')
  bootFetchDelayMs: 5000,            // indicators fetch when the app is idle after boot, never on the critical path

  // announcements (accent): wired end to end, off until maintained editorially
  announcementsEnabled: false,

  // build window: news dated after this build (plus a grace for entries written after the deploy)
  // is not in this build - shown apart, never badged
  buildGraceDays: 7,
  buildBehindNudgeDays: 14,          // the empty-chat line says the build is behind once it is this old

  // indicators - each placement can be turned off on its own
  indicatorNavDot: true,             // accent dot on the nav icon that holds What's New, for unseen announcements only
  indicatorPanelRow: true,           // desktop side panel row while something is new; mobile always lists What's New and Documentation there
  indicatorEmptyChat: true,          // line under the persona selector of an empty chat
  emptyChatLine: 'headlines' as 'headlines' | 'count', // 'New: Haiku 5.5, Claude Code, +3' or '5 changes since Oct 5'
  indicatorMaxCount: 99,             // shown as '99+' beyond

  // docs reader: the index at <apiBaseUrl>/docs, the pages from the /docs/<slug>.md twins under BaseProduct.DocsBaseSite, CORS-open
  docsStaleTimeMs: 60 * 60 * 1000,   // mirrors the index's and the .md twins' CDN s-maxage
  docsStartSlug: 'start-here' satisfies SiteDocSlug as SiteDocSlug, // the Start Here page: its home block is tinted

} as const;
