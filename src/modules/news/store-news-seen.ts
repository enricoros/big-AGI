import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { NewsAnnouncement, NewsChangelogGroup } from './news.feed';


/**
 * The "seen up to here" index: what this user has seen of the changelog and the announcements.
 *
 * Monotonic by construction - the watermark only moves forward and the id set only grows - so two
 * copies (e.g. two devices) merge with `newsSeenMerge` and never conflict.
 */
export interface NewsSeenIndex {
  changelog: NewsChangelogMark | null;  // null until the first changelog load
  announcementsSince: string | null;    // ISO day of the first load: announcements dated before it count as seen
  announcementIds: string[];            // announcements opened
}

export interface NewsChangelogMark {
  day: string;    // ISO day of the newest changelog day seen
  count: number;  // items that day had when seen - a later same-day addition counts as new
}


interface NewsSeenStore extends NewsSeenIndex {

  /** First load: everything published so far counts as seen, so new users start with nothing flagged */
  initSeen: (groups: NewsChangelogGroup[], today: string) => void;
  markChangelogSeen: (groups: NewsChangelogGroup[]) => void;
  markAnnouncementSeen: (id: string) => void;

}


export const useNewsSeenStore = create<NewsSeenStore>()(persist(
  (set, get) => ({

    changelog: null,
    announcementsSince: null,
    announcementIds: [],

    initSeen: (groups, today) => {
      const { changelog, announcementsSince } = get();
      const newest = _changelogNewestMark(groups);
      if ((changelog || !newest) && announcementsSince) return;
      set({
        ...(!changelog && newest ? { changelog: newest } : {}),
        ...(!announcementsSince ? { announcementsSince: today } : {}),
      });
    },

    markChangelogSeen: (groups) => {
      const { changelog } = get();
      const merged = _markMax(changelog, _changelogNewestMark(groups));
      if (merged !== changelog)
        set({ changelog: merged });
    },

    markAnnouncementSeen: (id) => {
      const { announcementIds } = get();
      if (!announcementIds.includes(id))
        set({ announcementIds: [...announcementIds, id] });
    },

  }),
  {
    name: 'app-news-seen',
    version: 1,
    partialize: ({ changelog, announcementsSince, announcementIds }) => ({ changelog, announcementsSince, announcementIds }),
  },
));

/** The local calendar day as 'YYYY-MM-DD': the feed's dates and the watermark are days in the user's zone, never UTC */
export function newsLocalDay(ms: number = Date.now()): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Dev builds: moves the index back `days` days (against the only-forward rule), so those days show as new */
export function newsSeenRewind(days: number): void {
  const day = newsLocalDay(Date.now() - days * 24 * 60 * 60 * 1000);
  useNewsSeenStore.setState({ changelog: { day, count: 0 }, announcementsSince: day, announcementIds: [] });
}


// Pure functions

/** Merge two copies: the newer watermark, the later baseline, the union of opened announcements. The sync contract. */
export function newsSeenMerge(a: NewsSeenIndex, b: NewsSeenIndex): NewsSeenIndex {
  return {
    changelog: _markMax(a.changelog, b.changelog),
    announcementsSince: (!a.announcementsSince || !b.announcementsSince) ? (a.announcementsSince || b.announcementsSince)
      : (a.announcementsSince > b.announcementsSince ? a.announcementsSince : b.announcementsSince),
    announcementIds: b.announcementIds.every(id => a.announcementIds.includes(id)) ? a.announcementIds
      : [...new Set([...a.announcementIds, ...b.announcementIds])],
  };
}

/**
 * Splits changelog days (feed order) at the watermark: `fresh` days hold items newer than it, `seen`
 * days don't. `count` is the new items; `more` when the watermark is older than the loaded pages and
 * older ones exist (the count is a floor).
 */
export function newsChangelogSplit(groups: NewsChangelogGroup[], mark: NewsChangelogMark | null, hasOlder: boolean) {
  const fresh: NewsChangelogGroup[] = [];
  const seen: NewsChangelogGroup[] = [];
  let count = 0;
  for (const group of groups) {
    // undated days can't be placed against the watermark: always seen
    const extra = !mark || !group.date ? 0
      : group.date > mark.day ? group.items.length
        : group.date === mark.day ? Math.max(0, group.items.length - mark.count)
          : 0;
    if (extra) {
      fresh.push(group);
      count += extra;
    } else
      seen.push(group);
  }
  const oldestDay = groups[groups.length - 1]?.date;
  const more = hasOlder && !!mark && !!oldestDay && oldestDay > mark.day;
  return { fresh, seen, count, more };
}

export function newsAnnouncementIsUnseen(announcement: NewsAnnouncement, seen: Pick<NewsSeenIndex, 'announcementsSince' | 'announcementIds'>): boolean {
  if (seen.announcementIds.includes(announcement.id)) return false;
  return !seen.announcementsSince || !announcement.date || announcement.date >= seen.announcementsSince;
}


function _changelogNewestMark(groups: NewsChangelogGroup[]): NewsChangelogMark | null {
  let mark: NewsChangelogMark | null = null;
  for (const { date, items } of groups) {
    if (!date) continue;
    if (!mark || date > mark.day) mark = { day: date, count: items.length };
    else if (date === mark.day) mark = { day: date, count: mark.count + items.length };
  }
  return mark;
}

function _markMax(a: NewsChangelogMark | null, b: NewsChangelogMark | null): NewsChangelogMark | null {
  if (!a || !b) return a || b;
  if (a.day !== b.day) return a.day > b.day ? a : b;
  return a.count >= b.count ? a : b;
}
