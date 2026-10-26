# News: What's New and the Docs Reader

**Status**: 🔵 ACTIVE - What's New (changelog), indicators, build window, docs reader with a contents tree and search, and the remote-feeds switch built on `/api/app/v1/news`; announcements wired and off.

One module, `src/modules/news/`, renders what big-agi.com publishes, inside the app, on every
codeline: What's New (the changelog, announcements, the per-user seen index) and the docs reader.
This doc is the system of record for both.

## Open actions

- [ ] [P1] Docs links in-app: `ExternalDocsLink` and the raw `DocsBaseSite` links open the reader at the slug and #anchor; ctrl/cmd-click keeps the browser
- [ ] [P1] Plan chips in page bodies: `> **Pro:**` callouts get a plan chip on open builds (the page header and the section rows already show the page's tier)
- [ ] [P2] Indicators: evaluate the three placements (nav dot, panel row, empty-chat line); turn off what does not earn its place in `NewsConfig`
- [ ] [P2] Announcements: set `announcementsEnabled` once new ones are written in the website's `news-src/`
- [ ] [P2] First-use callout: a second presentation of an announcement, keyed by its id where the feature lives; content from the feed, nothing blocks when it is missing
- [ ] [P2] Retire the systems marked "retire" in the inventory below
- [ ] [P2] Landing: the future `/` landing reads `useNews` (latest days, new announcements, actionable new models)
- [ ] [P3] Build window: dates plus a grace approximate "in this build"; an additive version field on change items would make it exact

## Why

The app showed news through a Google Doc iframe and a hardcoded `/news` page. The website already
publishes the same editorial content as frozen JSON feeds, and every docs page as a markdown twin.
Rendering those natively gives one source on every codeline, the app's theme, and a per-user
"new since your last visit".

## What

**Vocabulary.** The *changelog* is dated one-line items, editorially maintained, passive. An
*announcement* is a product, feature or resource worth explaining ("the desktop app is
available", "Ramble is here", "docs are available"): a stable id, optional video, images, body,
link. Announcements call for attention; the changelog never does.

**Files.**

| File | Holds |
|---|---|
| `news.config.ts` | `NewsConfig`: every parameter and limit, feed and docs |
| `news.platform.ts` | The codeline seam (below) |
| `news.feed.ts` | v1 wire schema, fetch, `useNewsFeed`, day grouping, `NewsAudience` |
| `store-news-seen.ts` | The seen index, `newsSeenMerge`, `newsChangelogSplit`, `newsSeenRewind` |
| `useNews.ts` | Build window, boot gate, `useNews`, headlines, formatters, the open state of both modals |
| `components/WhatsNewIndicators.tsx` | Eager entry points and `NewsModals` |
| `components/WhatsNewModal.tsx` | Lazy: the hub, changelog and announcement panes, the mini-format renderer |
| `components/DocsReaderModal.tsx` | Lazy: the reader, contents tree, search, index and page fetch |

**Data.** One stream, `/api/app/v1/news`, fetched from the browser with React Query. The request
names everything it wants - `kind=change` (`announcement,change` when announcements are on), `for=`
the tier, `channel=alpha` when the codeline asks for previews - and gets nothing else. Pages are cut
on whole days; the server's `more` cursor fetches older ones ("Load older"). URLs are canonical, so
every client with the same audience shares the CDN entries; a page is about 1-3 KB compressed.
Nothing per-user goes to the server; "new since" is derived on the client. Indicators fetch when
the app is idle after boot; an open surface fetches immediately. The wire contract is authoritative
in the website repo (`kb/feature-app-news-api.md`); the client Zod schema validates each item on its
own and drops kinds it doesn't know.

**Audience.** Items carry a `for:` subset, authored as a ladder: omit it when the subject is on the
open codeline (everyone), `free, pro` for hosted only, `pro` for Pro only, `open` for self-host
material. Changelog lines take it as a trailing `[free, pro]` tag in the Google Doc. Each build asks
for its own tier only: open builds as `open`, the hosted codeline as `free` or `pro`, so it sees the
open list plus its own.

**Seen index** (`store-news-seen.ts`, localStorage). The changelog watermark is the newest seen day
plus its item count, so a same-day addition re-flags that day. Announcements are an id set plus the
first-load day; older ones count as seen. The first load marks everything seen, so new users start
with nothing flagged. The index only advances, so two copies merge without conflicts
(`newsSeenMerge`, the contract for a future account sync). `newsChangelogSplit` gives every caller
the same `{ fresh, seen, count, more }`; `more` marks the count as a floor ("20+").

**Build window.** News dated after this build plus `buildGraceDays` is not in this build. It is
listed apart - a folded neutral band on top of the changelog with the codeline's after-build hint -
and never badged or counted as new. The watermark advances only over what the build has, so after
an update those days count as new. Once the build is `buildBehindNudgeDays` old, the empty-chat
line says how far behind it is.

**What's New.** A dated ledger: sticky month headers, the day number in a narrow column, bulleted
items with **bold** runs in the primary text color, a hairline between days. An item with `docs`
ends with a "Docs" link that opens the reader at that page. The hub is one pane until there are
announcements, then two, in the Preferences shape. On open the hub snapshots the watermark and
renders against it; the changelog counts as seen as soon as it loads, so the indicators clear on
open while the view stays put. The new count is a chip in the title; new days come first, seen days
fold behind "Show N earlier days"; expanded, an "Already seen" divider marks the watermark, and
"Load older" fetches the next page. The scroll pane takes the initial focus.

**Dev rewind.** In development builds the hub's title carries `-1d`, `-7d` and `-30d` chips:
`newsSeenRewind(n)` moves the index back n days (changelog `{ day: today - n, count: 0 }`, the same
announcements day, no opened ids) and closes the hub, so every indicator shows its new state.

**Docs reader.** The Preferences two-pane shape. Left: a search field, then the contents tree of
the static docs index (`/docs/index.json`, nav order), shaped as the big-agi.com docs sidebar and
showing only the active branch: every section header; pages by their nav `label` only in the
section selected or holding the current page; `indent` pages one level in, only while their parent
or one of them is current; the `setMember` pages folded under one "N providers" row that opens while
it holds the current page; a "new" chip on `new` pages; the current page selected. A header opens
its `lead` page, not repeated as a row; without a lead it opens the section index.
ArrowUp/ArrowDown move through the visible rows, Enter opens. The nav fields are optional: without
them the tree is flat, by title. Home lists the sections with an outline of their pages. Every view sits in one 70ch column. A
section lists its pages, names in the link color, with two-line summaries and a Free or Pro chip;
`provider` pages list under "AI services" as a grid. Lists and breadcrumbs name a page by its
label; the page view keeps the full title. Search filters on every keystroke: words AND-matched over
label and title, answers, summary and slug, ranked label and title > answer > summary; each result shows its section inline
and the best-matching question with the hits in bold; while the field has focus the first result is
marked as the Enter target. `/` focuses search, ArrowDown enters the results (the tree when the field is empty), Enter opens the first,
Esc clears the field before it closes the modal. A page is its markdown twin: the title one step
above the body's headings, summary as the lead, tier and update day from the index, then the app's
markdown renderer. Links between docs pages navigate in place;
the title is back, forward, then breadcrumbs (Documentation > Section > Page); Alt+Left/Right go
back and forward. A loading page keeps the previous view up under a progress bar. If the index
fails, a button opens `start-here`. Mobile is fullscreen, with search and a page picker (pages grouped by section) stacked.

**Entry points.** `WhatsNewIndicators.tsx` holds them as self-contained components, so each
codeline places one with one line: the nav dot (neutral for the changelog, accent for
announcements), the What's New and Documentation menu items, the side panel rows, and the empty-chat
line - headlines from the new lines' **bold** runs ("New: Haiku 5.5, Claude Code, +3"), or the
count, per `NewsConfig.emptyChatLine`. The panel shows the What's New row on desktop only while
something is new; on mobile, where the panel holds the only entry points, it always shows What's New
and Documentation. `NewsModals` mounts both lazy modals once with the app modals; their open state
is one small store (`newsOpenWhatsNew`, `newsOpenDocs`).

**Remote-feeds switch.** `NEXT_PUBLIC_BIG_AGI_REMOTE_FEEDS=off`, set at build time, stops every
request the app makes to big-agi.com on its own: no indicators, What's New hidden, Documentation
opens in a browser tab. Default on everywhere, prebuilt Docker images included (they cannot turn it
off at runtime); the hosted codeline does not read it.

**Codeline seam.** `news.platform.ts` is the one file that differs between codelines:
`NewsPlatform.afterBuildHint` (the after-build message) and `useNewsAudience()`, which returns
`{ off, tier, channel }`. Open builds: `off` from the remote-feeds switch, tier `open`, no channel,
"Pull the latest image" on Docker, else "Update your deployment". The hosted codeline: never off,
`free` or `pro` by plan, `alpha` on staging and for alpha users, "Reload to get them".

## Inventory

Existing mechanisms that overlap News on this codeline.

| Mechanism | What it does | Disposition |
|---|---|---|
| `/news` page and boot redirect (`Release.Monotonics.NewsVersion`) | Hardcoded `news.data.tsx`; redirects once per bump after 3 sessions | Retire |
| Repo `docs/` folder | GitHub-only markdown, superseded by big-agi.com/docs | Notice added; trim to self-host material |
| `FeatureBadge` | One-time discovery dot, dismissed forever | Keep, different purpose |
| MOTD (`NEXT_PUBLIC_MOTD`) | Deployment banner | Keep, operator channel |
| Models "Updates" screen | Local diff of model-list refreshes | Keep, different subject |
| `BuildInfoCard` | Build details | Keep |
