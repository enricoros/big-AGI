import * as React from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import type { SiteDocSlug } from '~/common/gen/com.site.docs.slug';
import { BaseProduct, Release } from '~/common/app.release';
import { runWhenIdle } from '~/common/util/pwaUtils';

import type { NewsAnnouncement } from './news.feed';
import { NewsConfig } from './news.config';
import { newsAnnouncementIsUnseen, newsChangelogSplit, newsLocalDay, useNewsSeenStore } from './store-news-seen';
import { newsGroupChanges, useNewsFeed } from './news.feed';
import { useNewsAudience } from './news.platform';


// Modals: what What's New and the docs reader show. Not persisted; rendered once by NewsModals.

export interface NewsDocsTarget {
  slug: SiteDocSlug | null; // null: the docs home
  anchor?: string;          // heading id within the page, without '#'
}

const useNewsModalsStore = create<{ whatsNewOpen: boolean, docsTarget: NewsDocsTarget | null }>()(() => ({
  whatsNewOpen: false,
  docsTarget: null, // null: the reader is closed
}));

export function useNewsModals() {
  return useNewsModalsStore(useShallow(state => ({ whatsNewOpen: state.whatsNewOpen, docsTarget: state.docsTarget })));
}

export function newsOpenWhatsNew() {
  useNewsModalsStore.setState({ whatsNewOpen: true });
}

export function newsCloseWhatsNew() {
  useNewsModalsStore.setState({ whatsNewOpen: false });
}

export function newsOpenDocs(slug: SiteDocSlug | null = null, anchor?: string) {
  useNewsModalsStore.setState({ docsTarget: { slug, anchor } });
}

export function newsCloseDocs() {
  useNewsModalsStore.setState({ docsTarget: null });
}

// a big-agi.com docs link: the docs home, or a page with an optional #anchor
const _docsLinkPattern = new RegExp('^' + BaseProduct.DocsBaseSite.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:/([a-z0-9-]+))?/?(?:#([\\w-]+))?$');

/** Reader target of a big-agi.com docs link, or null for any other URL */
export function newsDocsLinkTarget(href: string): NewsDocsTarget | null {
  const match = href.match(_docsLinkPattern);
  return !match ? null : { slug: (match[1] || null) as SiteDocSlug | null, anchor: match[2] };
}

/**
 * Plain clicks on big-agi.com docs links anywhere in the app open the reader; modified clicks keep the
 * browser, and the open reader handles its own links. Returns the cleanup.
 */
export function newsInterceptDocsLinks(): () => void {
  const handleClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (useNewsModalsStore.getState().docsTarget) return;
    const anchor = event.target instanceof Element ? event.target.closest('a') : null;
    const target = anchor ? newsDocsLinkTarget(anchor.href) : null;
    if (!target) return;
    event.preventDefault();
    useNewsModalsStore.setState({ docsTarget: target });
  };
  document.addEventListener('click', handleClick);
  return () => document.removeEventListener('click', handleClick);
}


// Build window

const _buildDay: string | null = Release.buildInfo('frontend').timestamp?.slice(0, 10) || null;
const _buildCutoffDay: string | null = !_buildDay ? null : _isoDayPlus(_buildDay, NewsConfig.buildGraceDays);

/** ISO day this frontend was built, or null when unknown */
export function newsBuildDay(): string | null {
  return _buildDay;
}

/** True once this build is old enough that the empty-chat line says so */
export function newsBuildIsBehind(): boolean {
  return !!_buildDay && _isoDayPlus(_buildDay, NewsConfig.buildBehindNudgeDays) <= newsLocalDay();
}

function _isoDayPlus(isoDay: string, days: number): string {
  return new Date(Date.parse(isoDay + 'T00:00:00Z') + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}


// Boot gate: indicators fetch once the app is idle after boot - never on the critical path
const useBootGateStore = create<{ open: boolean }>()(() => ({ open: false }));
let _bootGateScheduled = false;

function useNewsBootGate(): boolean {
  const open = useBootGateStore(state => state.open);
  React.useEffect(() => {
    if (_bootGateScheduled) return;
    _bootGateScheduled = true;
    setTimeout(() => runWhenIdle(() => useBootGateStore.setState({ open: true }), 2000), NewsConfig.bootFetchDelayMs);
  }, []);
  return open;
}


/**
 * News for every surface: the feed, split by what this build has, and what is new against the seen index.
 *
 * `immediate` fetches right away (an open surface); otherwise the fetch waits for the boot gate.
 * Pages are shared across mounts by React Query, so any number of surfaces cost one fetch.
 * Only what this build has counts as new: the rest is listed apart, never badged.
 */
export function useNews(immediate: boolean) {

  // external state
  const { off, tier, channel } = useNewsAudience();
  const bootGateOpen = useNewsBootGate();
  const { items, isError, hasMore, loadMore, isLoadingMore } = useNewsFeed(!off && (immediate || bootGateOpen), tier, channel);
  const { changelogMark, announcementsSince, announcementIds } = useNewsSeenStore(useShallow(state => ({
    changelogMark: state.changelog,
    announcementsSince: state.announcementsSince,
    announcementIds: state.announcementIds,
  })));

  // derived: changelog days, split by this build; days dated past tomorrow are dropped (a mis-dated
  // entry would otherwise tell every build it is behind; the day of slack covers time zones)
  const { changelogGroups, changelogAfterBuild } = React.useMemo(() => {
    if (!items) return { changelogGroups: null, changelogAfterBuild: [] };
    const tomorrow = _isoDayPlus(newsLocalDay(), 1);
    const groups = newsGroupChanges(items).filter(group => group.date <= tomorrow);
    const cutoff = _buildCutoffDay;
    if (!cutoff) return { changelogGroups: groups, changelogAfterBuild: [] };
    return {
      changelogGroups: groups.filter(group => group.date <= cutoff),
      changelogAfterBuild: groups.filter(group => group.date > cutoff),
    };
  }, [items]);

  // [effect] first load: everything this build has counts as seen
  React.useEffect(() => {
    if (changelogGroups)
      useNewsSeenStore.getState().initSeen(changelogGroups, newsLocalDay());
  }, [changelogGroups]);

  // derived: what is new against the live watermark
  const { changelogNewItems, changelogNewCount, changelogNewMore } = React.useMemo(() => {
    if (!changelogGroups) return { changelogNewItems: [], changelogNewCount: 0, changelogNewMore: false };
    const { fresh, count, more } = newsChangelogSplit(changelogGroups, changelogMark, hasMore);
    return { changelogNewItems: fresh.flatMap(group => group.items), changelogNewCount: count, changelogNewMore: more };
  }, [changelogGroups, changelogMark, hasMore]);
  const changelogAfterBuildCount = changelogAfterBuild.reduce((sum, group) => sum + group.items.length, 0);

  const announcements = React.useMemo(() => !NewsConfig.announcementsEnabled || !items ? null
    : items.filter((item): item is NewsAnnouncement => item.kind === 'announcement'), [items]);
  const announcementsNewCount = React.useMemo(() => announcements?.filter(announcement =>
    (!_buildCutoffDay || announcement.date <= _buildCutoffDay)
    && newsAnnouncementIsUnseen(announcement, { announcementsSince, announcementIds }),
  ).length ?? 0, [announcementIds, announcements, announcementsSince]);

  return {
    off,                      // the operator turned the feeds off - hide every surface
    changelogGroups,          // days this build has, as far as loaded; null until the first page
    changelogError: isError && !changelogGroups, // the first page failed
    changelogAfterBuild,      // days newer than this build (plus grace)
    changelogAfterBuildCount, // their items - informational, never badged
    changelogMark,            // the live watermark (the hub snapshots it on open, so marking seen doesn't reshuffle the view)
    changelogNewItems,        // changelog items new since the watermark - passive
    changelogNewCount,
    changelogNewMore,         // new items run past the loaded page: the count is uncountable ('many')
    changelogHasOlder: hasMore,
    changelogLoadOlder: loadMore,
    changelogLoadingOlder: isLoadingMore,
    announcements,            // null until loaded, or when announcements are off
    announcementsNewCount,    // announcements not opened yet - calls for attention
  };
}


// Formatting

/** "Oct 5" from an ISO day, parsed as a local date (no timezone day-shift) */
export function newsFormatDay(isoDay: string): string {
  const [year, month, day] = isoDay.split('-').map(part => parseInt(part, 10));
  if (!year || !month || !day) return isoDay;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** '23 changes', '1 change', or 'many changes' when the new items run past the loaded page: uncountable, never a floor */
export function newsFormatChanges(count: number, more: boolean = false): string {
  return more ? 'many changes' : `${count} ${count === 1 ? 'change' : 'changes'}`;
}
