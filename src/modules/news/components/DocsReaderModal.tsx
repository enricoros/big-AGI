import * as React from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as z from 'zod/v4';

import { Box, Button, Chip, Divider, IconButton, Input, LinearProgress, Link, List, ListItem, ListItemButton, ListItemContent, ListItemDecorator, ListSubheader, modalDialogClasses, Option, Select, Tooltip, Typography } from '@mui/joy';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import LaunchIcon from '@mui/icons-material/Launch';
import SearchIcon from '@mui/icons-material/Search';

import { RenderMarkdownMemo } from '~/modules/blocks/markdown/RenderMarkdown';
import { useScaledTypographySx } from '~/modules/blocks/blocks.styles';

import type { SiteDocSlug } from '~/common/gen/com.site.docs.slug';
import { AppBreadcrumbs } from '~/common/components/AppBreadcrumbs';
import { BaseProduct } from '~/common/app.release';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { PhHouse } from '~/common/components/icons/phosphor/PhHouse';
import { frontendSideFetch } from '~/common/util/clientFetchers';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUIContentScaling } from '~/common/stores/store-ui';

import type { NewsDocsTarget } from '../useNews';
import { NewsConfig } from '../news.config';
import { newsCloseDocs, newsDocsLinkTarget, newsFormatDay } from '../useNews';


// a tree row: transparent at rest, the selection as a 4px inset bar - accent on index rows (they list
// pages), primary on rows that open a page; the row's own color= tints the selected background
function _navRow(color: 'primary' | 'accent') {
  return {
    border: 0, // ListItemButton keeps a 1px border otherwise
    backgroundColor: 'transparent',
    '&.Mui-selected': {
      boxShadow: `inset 4px 0 0 0 var(--joy-palette-${color === 'accent' ? 'accent-700' : 'primary-solidBg'})`,
      color: `${color}.softColor`,
    },
  } as const;
}

const _homeBlock = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 1,
  p: 2.5,
  borderRadius: 'md',
  backgroundColor: 'neutral.softBg',
} as const;

const _styles = {

  // desktop: the Preferences two-pane shape; panes keep one height across pages, and fill when maximized
  modalDesktop: {
    boxShadow: 'none',
    backgroundColor: 'background.level1',
    width: 'min(940px, 94vw)',
    maxWidth: 'min(940px, 94vw)',
    minHeight: 0,
    [`&.${modalDialogClasses.layoutFullscreen}`]: {
      '--DocsReader-paneHeight': 'auto',
    },
  },
  body: {
    flex: '1 1 auto', // auto basis: the height below holds (a 0 basis would size the dialog to its content)
    minHeight: 0,
    height: 'var(--DocsReader-paneHeight, min(72svh, 800px))', // on the grid, so a long tree scrolls instead of growing the row
    display: 'grid',
    gridTemplateColumns: '232px minmax(0, 1fr)',
    gridTemplateRows: 'minmax(0, 1fr)',
    mx: 'calc(-1 * var(--Card-padding))',
  },
  nav: {
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5,
    pt: 2,
  },
  navSearch: {
    mx: 1.5,
  },
  navList: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    pb: 2,
    '--ListItem-minHeight': '2rem',
  },

  // the tree: SettingsNavList's top-level and child items, plus one more level; index rows in accent
  navHeader: {
    ..._navRow('primary'),
    pl: 2,
    fontWeight: 'md',
  },
  navHeaderIndex: {
    ..._navRow('accent'),
    pl: 2,
    fontWeight: 'md',
  },
  navSectionGap: {
    mt: 1.5,
  },
  navPage: {
    ..._navRow('primary'),
    pl: 3.5,
  },
  navPageNested: {
    ..._navRow('primary'),
    pl: 5,
  },
  navLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  navCaret: {
    transition: 'transform 0.15s',
  },
  navCaretOpen: {
    transition: 'transform 0.15s',
    transform: 'rotate(90deg)',
  },
  newChip: {
    flexShrink: 0,
    fontWeight: 'lg',
  },
  optionNested: {
    pl: 3.5,
  },
  content: {
    position: 'relative',
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'background.popup',
    borderRadius: 'lg',
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    boxShadow: 'md',
    overflow: 'hidden',
    zIndex: 1,
  },
  scroller: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    px: 'var(--Card-padding)',
    py: 2,
    outline: 'none',
  },
  progress: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    '--LinearProgress-radius': '0px',
  },

  // mobile: fullscreen; search and the page picker stacked over the content
  modalMobile: {
    minHeight: 0,
    backgroundColor: 'background.level1',
  },
  mobileBody: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  mobileContent: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    mx: 'calc(-1 * var(--Card-padding))',
    backgroundColor: 'background.popup',
    boxShadow: 'xs',
  },

  // title: history, then breadcrumbs
  titleBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    minWidth: 0,
    // the tooltip spans around the history buttons: no inline line box, so the buttons center on the crumbs
    '& > span': { display: 'flex' },
  },
  titleButton: {
    my: -0.5,
  },
  titleHome: {
    fontSize: 'xl',
    my: -1, // out of the line box, so the title bar keeps its height
    position: 'relative',
    top: '0.3rem', // centered on the crumbs: the icon otherwise rides above their baseline
  },

  // section index: a soft block per page, as on the home; AI services as soft tiles
  sectionPages: {
    '--List-gap': '0.75rem',
    py: 1,
  },
  sectionPage: {
    p: 2.5,
    gap: 1.5,
    borderRadius: 'md',
  },
  sectionServices: {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
    gap: 0.75,
    pb: 1,
  },
  sectionServicesHead: {
    gridColumn: '1 / -1',
    mt: 1.5,
  },
  sectionService: {
    borderRadius: 'sm',
  },
  clamp2: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },

  // search results
  hitButton: {
    py: 1,
    borderRadius: 'sm',
  },
  hits: {
    '& strong': {
      color: 'text.primary',
      fontWeight: 'lg',
    },
  },
  hitHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    minWidth: 0,
  },
  hitSection: {
    flexShrink: 0,
  },
  hitChevron: {
    flexShrink: 0,
    fontSize: 'md',
    color: 'text.tertiary',
  },
  hitEnter: {
    ml: 'auto',
    color: 'text.tertiary',
  },

  // home: a soft block per section, as on big-agi.com/docs
  home: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5,
    py: 1,
  },
  homeBlock: _homeBlock,
  homeBlockStart: {
    ..._homeBlock,
    backgroundColor: 'accent.softBg',
  },
  homeLinks: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 0.5,
  },
  homeLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  },

  // every view: one reading column, centered when maximized
  column: {
    maxWidth: '70ch',
    mx: 'auto',
  },
  pageHead: {
    px: '0.75rem', // RenderMarkdown's own inline margin
    pt: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5,
  },
  pageTitleChips: {
    display: 'inline-flex',
    gap: 1,
    ml: 1.5,
    my: -1, // riding the title's middle, out of its line box
    verticalAlign: 'middle',
  },
  pageDivider: {
    mx: '0.75rem',
    my: 3,
    opacity: 0.4, // a hint, not a rule
  },
  pageFoot: {
    px: '0.75rem',
    mt: 4,
    color: 'text.tertiary',
  },
  message: {
    p: 1.5,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    flexWrap: 'wrap',
  },

} as const;


/// Docs index: the static big-agi.com /docs/index.json - every readable docs page, in nav order.
/// Built by the website's docs generator from content dates only, so it changes only when the docs do.

const docsIndexEntrySchema = z.object({
  slug: z.custom<SiteDocSlug>(value => typeof value === 'string'), // the website's slugs: the set SiteDocSlug is generated from
  title: z.string(),
  summary: z.string(),
  section: z.string(),            // nav group title
  tier: z.string(),               // minimum tier: open | free | pro (open string: new tiers render as text)
  kind: z.string().optional(),    // page type: 'provider' pages list as AI services
  answers: z.array(z.string()),   // the questions the page answers
  updated: z.string(),            // ISO day of the newest content change
  // nav fields, all optional: without them the tree shows titles, flat, with no set and no tags
  label: z.string().optional(),       // short nav name ('Ramble'); the title when absent
  indent: z.boolean().optional(),     // one level in, under the previous page
  setMember: z.boolean().optional(),  // in the provider set, folded under one row
  new: z.boolean().optional(),        // the docs site's "new" tag
});

const docsIndexSchema = z.object({
  v: z.literal(1),
  docs: z.array(docsIndexEntrySchema),
  sections: z.array(z.object({   // optional: nav groups in order
    title: z.string(),           // as the docs' `section`
    lead: z.string().nullable(), // the page the header stands for; null: a label only
  })).optional(),
});

type DocsIndex = z.infer<typeof docsIndexSchema>;
type DocsIndexEntry = z.infer<typeof docsIndexEntrySchema>;

type DocsNavRow =
  | { kind: 'page', doc: DocsIndexEntry, children: DocsIndexEntry[] } // children: the `indent` pages under it
  | { kind: 'set', docs: DocsIndexEntry[] }; // the section's setMember pages, one expandable row

interface DocsSection {
  title: string;
  docs: DocsIndexEntry[];       // every page, nav order
  lead: DocsIndexEntry | null;  // the page the header opens, not repeated as a row; null: the header opens the section index
  rows: DocsNavRow[];           // the tree under the header
}

async function _fetchDocsIndex(signal?: AbortSignal): Promise<DocsIndex> {
  const response = await frontendSideFetch(`${BaseProduct.DocsBaseSite}/index.json`, { signal });
  if (!response.ok)
    throw new Error(`Docs index: HTTP ${response.status}`);
  const index = docsIndexSchema.safeParse(await response.json());
  if (!index.success) {
    console.error('[docs] invalid docs index:', index.error.issues);
    throw new Error('Docs index: unexpected payload');
  }
  return index.data;
}

/** Sections in nav order; a section's lead comes from the index's `sections`, when it names one */
function _docsSections(index: DocsIndex | null): DocsSection[] {
  const groups: { title: string, docs: DocsIndexEntry[] }[] = [];
  for (const doc of index?.docs ?? []) {
    const last = groups[groups.length - 1];
    if (last?.title === doc.section) last.docs.push(doc);
    else groups.push({ title: doc.section, docs: [doc] });
  }
  return groups.map(({ title, docs }) => {
    const leadSlug = index?.sections?.find(section => section.title === title)?.lead;
    const lead = leadSlug ? docs.find(doc => doc.slug === leadSlug) ?? null : null;
    const rows: DocsNavRow[] = [];
    let set: DocsIndexEntry[] | null = null;
    for (const doc of docs) {
      const prev = rows[rows.length - 1];
      if (doc === lead) continue;
      if (doc.setMember) {
        if (set) set.push(doc);
        else rows.push({ kind: 'set', docs: set = [doc] });
      } else if (doc.indent && prev?.kind === 'page')
        prev.children.push(doc);
      else
        rows.push({ kind: 'page', doc, children: [] });
    }
    return { title, docs, lead, rows };
  });
}

function _docLabel(doc: DocsIndexEntry): string {
  return doc.label ?? doc.title;
}

function _setLabel(docs: DocsIndexEntry[]): string {
  return `${docs.length} providers`;
}


/// Docs page: the /docs/<slug>.md twin

interface DocsPage {
  slug: SiteDocSlug;
  title: string;
  summary: string | null;
  markdown: string;
}

/**
 * Parses a twin: `# Title`, `> summary`, then `- Key: value` metadata lines (Canonical, Minimum tier,
 * Kind, Answers), then the body. Relative /docs/ links and images are made absolute, as the page
 * renders on another origin.
 */
function _parseDocsPage(slug: SiteDocSlug, text: string): DocsPage {
  const lines = text.split('\n');
  let title = '';
  let summary: string | null = null;
  let idx = 0;
  for (; idx < lines.length; idx++) {
    const line = lines[idx];
    if (!title && line.startsWith('# ')) title = line.slice(2).trim();
    else if (!summary && line.startsWith('> ')) summary = line.slice(2).trim();
    else if (/^- (Canonical|Minimum tier|Kind|Answers):/.test(line) || !line.trim()) continue;
    else break;
  }
  const markdown = lines.slice(idx).join('\n').replace(/\]\(\/docs\//g, `](${BaseProduct.DocsBaseSite}/`);
  return { slug, title, summary, markdown };
}

async function _fetchDocsPage(slug: SiteDocSlug, signal?: AbortSignal): Promise<DocsPage> {
  const response = await frontendSideFetch(`${BaseProduct.DocsBaseSite}/${slug}.md`, { signal });
  if (!response.ok)
    throw new Error(`Docs: HTTP ${response.status}`);
  return _parseDocsPage(slug, await response.text());
}

// GitHub-style heading id, to resolve #anchors
function _headingId(text: string): string {
  return text.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
}


/// Search: words AND-matched over label and title, answers, summary and slug; ranked label and title > answer > summary and slug

interface DocsHit {
  doc: DocsIndexEntry;
  answer: string | null; // the answer matching the most words
  score: number;
}

function _searchWords(query: string): string[] {
  // longest first: the highlight pattern prefers the longer of overlapping words
  return query.toLowerCase().split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length);
}

function _docsSearch(docs: DocsIndexEntry[], words: string[]): DocsHit[] {
  const hits: DocsHit[] = [];
  for (const doc of docs) {
    const title = (doc.label ? `${doc.label} ${doc.title}` : doc.title).toLowerCase();
    const summary = doc.summary.toLowerCase();
    const slug = doc.slug.replace(/-/g, ' '); // names features the title may not: 'feature-ramble'
    const answers = doc.answers.map(answer => answer.toLowerCase());
    let score = 0;
    for (const word of words) {
      const wordScore = title.includes(word) ? 3 : answers.some(answer => answer.includes(word)) ? 2 : (summary.includes(word) || slug.includes(word)) ? 1 : 0;
      if (!wordScore) {
        score = 0;
        break;
      }
      score += wordScore;
    }
    if (!score) continue;
    let answer: string | null = null;
    let answerWords = 0;
    for (let i = 0; i < answers.length; i++) {
      const matched = words.filter(word => answers[i].includes(word)).length;
      if (matched > answerWords) {
        answer = doc.answers[i];
        answerWords = matched;
      }
    }
    hits.push({ doc, answer, score });
  }
  return hits.sort((a, b) => b.score - a.score); // stable: nav order within a score
}

function _highlight(text: string, words: string[]): React.ReactNode {
  if (!words.length) return text;
  const pattern = new RegExp(`(${words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(pattern).map((part, i) => i % 2 ? <strong key={i}>{part}</strong> : part);
}


/// Views

type DocsView =
  | { kind: 'section', section: string | null } // null: home, every section
  | { kind: 'page', slug: SiteDocSlug, anchor?: string };

function _viewFromTarget(target: NewsDocsTarget): DocsView {
  return target.slug ? { kind: 'page', slug: target.slug, anchor: target.anchor } : { kind: 'section', section: null };
}

function _viewEquals(a: DocsView, b: DocsView): boolean {
  if (a.kind === 'section') return b.kind === 'section' && a.section === b.section;
  return b.kind === 'page' && a.slug === b.slug && a.anchor === b.anchor;
}


function DocsTierChip(props: { tier: string }) {
  if (props.tier === 'open') return null;
  return <Chip size='sm' variant='soft' color='neutral'>{props.tier.charAt(0).toUpperCase() + props.tier.slice(1)}</Chip>;
}

function DocsNewChip() {
  return <Chip size='sm' variant='solid' color='accent' sx={_styles.newChip}>new</Chip>;
}


/** Home: one block per section - title, the lead's summary, a few pages and the rest as a count; Start Here tinted */
function DocsHomeView(props: { sections: DocsSection[], onOpenSection: (title: string) => void, onOpen: (slug: SiteDocSlug) => void }) {
  const { onOpenSection, onOpen } = props;
  return (
    <Box sx={_styles.home}>
      {props.sections.map(section => {
        const { picks, more } = _homePicks(section);
        return (
          <Box key={section.title} sx={section.lead?.slug === NewsConfig.docsFallbackSlug ? _styles.homeBlockStart : _styles.homeBlock}>
            <Link component='button' level='title-md' fontWeight='lg' textColor='text.primary' underline='hover' onClick={() => onOpenSection(section.title)}>
              {section.title}
            </Link>
            {!!section.lead?.summary && <Typography level='body-sm' textColor='text.tertiary'>{section.lead.summary}</Typography>}
            <Box sx={_styles.homeLinks}>
              {picks.map(doc => (
                <Box key={doc.slug} sx={_styles.homeLink}>
                  <Link component='button' level='body-sm' fontWeight='md' color='accent' underline='hover' onClick={() => onOpen(doc.slug)}>{_docLabel(doc)}</Link>
                  {doc.new && <DocsNewChip />}
                </Box>
              ))}
              {more > 0 && (
                <Link component='button' level='body-sm' textColor='text.tertiary' underline='hover' onClick={() => onOpenSection(section.title)}>
                  +{more} more
                </Link>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/** A home block's pages: the first two plus any new ones, in nav order; a lone remainder joins them */
function _homePicks(section: DocsSection): { picks: DocsIndexEntry[], more: number } {
  const pages = section.rows.flatMap(row => row.kind === 'page' ? [row.doc] : []);
  const total = section.docs.length - (section.lead ? 1 : 0);
  let picks = pages.filter((doc, idx) => idx < 2 || doc.new);
  if (total - picks.length === 1 && pages.length === picks.length + 1) picks = pages;
  return { picks, more: total - picks.length };
}


/** A section: its pages with summaries; provider pages as a grid of AI services */
function DocsSectionView(props: { docs: DocsIndexEntry[], onOpen: (slug: SiteDocSlug) => void }) {
  const { onOpen } = props;
  const pages = props.docs.filter(doc => doc.kind !== 'provider');
  const services = props.docs.filter(doc => doc.kind === 'provider');
  return <>
    {pages.length > 0 && (
      <List sx={_styles.sectionPages}>
        {pages.map(doc => (
          <ListItem key={doc.slug}>
            <ListItemButton variant='soft' onClick={() => onOpen(doc.slug)} sx={_styles.sectionPage}>
              <ListItemContent>
                <Typography level='title-md' fontWeight='lg'>{_docLabel(doc)}</Typography>
                <Typography level='body-sm' textColor='text.tertiary' sx={_styles.clamp2}>{doc.summary}</Typography>
              </ListItemContent>
              {doc.new && <DocsNewChip />}
              <DocsTierChip tier={doc.tier} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    )}
    {services.length > 0 && (
      <List size='sm' sx={_styles.sectionServices}>
        <ListSubheader sx={_styles.sectionServicesHead}>AI services</ListSubheader>
        {services.map(doc => (
          <ListItem key={doc.slug}>
            <ListItemButton variant='soft' onClick={() => onOpen(doc.slug)} sx={_styles.sectionService}>
              <ListItemContent>
                <Typography level='body-sm' fontWeight='md' color='accent'>{_docLabel(doc)}</Typography>
              </ListItemContent>
              {doc.new && <DocsNewChip />}
              <DocsTierChip tier={doc.tier} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    )}
  </>;
}


function DocsNavPage(props: { doc: DocsIndexEntry, nested: boolean, selected: boolean, onOpen: (slug: SiteDocSlug) => void }) {
  const { doc, selected, onOpen } = props;
  return (
    <ListItem>
      <ListItemButton
        data-docs-row
        selected={selected}
        color={selected ? 'primary' : undefined}
        variant={selected ? undefined : 'soft'}
        title={doc.title}
        onClick={() => onOpen(doc.slug)}
        sx={props.nested ? _styles.navPageNested : _styles.navPage}
      >
        <ListItemContent sx={_styles.navLabel}>{_docLabel(doc)}</ListItemContent>
        {doc.new && <DocsNewChip />}
      </ListItemButton>
    </ListItem>
  );
}

/**
 * The contents tree, active branch only: every section header; the pages, by label, of the section
 * selected or holding the current page; `indent` pages one level in, while their parent or one of
 * them is current; the provider set under one row, open unless folded by hand.
 * ArrowUp/ArrowDown move through the visible rows, up from the first returns to search; Enter opens.
 */
function DocsNavTree(props: {
  sections: DocsSection[],
  currentSlug: SiteDocSlug | null,
  currentSection: string | null, // a section index on screen
  atHome: boolean,
  listRef: React.RefObject<HTMLUListElement>,
  onHome: () => void,
  onOpen: (slug: SiteDocSlug) => void,
  onOpenSection: (title: string) => void,
  onExitUp: () => void,
}) {

  const { currentSlug, currentSection, listRef, onOpen, onOpenSection, onExitUp } = props;

  // a set folded by hand stays folded until the current page changes, then opens again
  const [toggles, setToggles] = React.useState<{ slug: SiteDocSlug | null, open: Readonly<Record<string, boolean>> }>({ slug: currentSlug, open: {} });
  const setsOpen = toggles.slug === currentSlug ? toggles.open : {};

  // [effect] keep the current row in view (it may sit in a set that just opened)
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-docs-row].Mui-selected')?.scrollIntoView({ block: 'nearest' });
  }, [currentSection, currentSlug, listRef, props.sections]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-docs-row]'));
    const next = rows.findIndex(row => row === document.activeElement) + (event.key === 'ArrowDown' ? 1 : -1);
    if (next < 0) onExitUp();
    else rows[Math.min(next, rows.length - 1)]?.focus();
  }, [onExitUp]);

  return (
    <List ref={listRef} size='sm' onKeyDown={handleKeyDown} sx={_styles.navList}>

      {/* the docs home, like the Documentation crumb */}
      <ListItem>
        <ListItemButton
          data-docs-row
          selected={props.atHome}
          color={props.atHome ? 'accent' : undefined}
          variant={props.atHome ? undefined : 'soft'}
          onClick={props.onHome}
          sx={_styles.navHeaderIndex}
        >
          <ListItemDecorator><PhHouse /></ListItemDecorator>
          <ListItemContent sx={_styles.navLabel}>Docs</ListItemContent>
        </ListItemButton>
      </ListItem>

      {props.sections.map(section => {
        const { lead } = section;
        const headerSelected = lead ? lead.slug === currentSlug : section.title === currentSection;
        const active = section.title === currentSection || section.docs.some(doc => doc.slug === currentSlug);
        return (
          <React.Fragment key={section.title}>

            {/* header: the lead page, else the section index */}
            <ListItem sx={_styles.navSectionGap}>
              <ListItemButton
                data-docs-row
                selected={headerSelected}
                color={!headerSelected ? undefined : lead ? 'primary' : 'accent'}
                variant={headerSelected ? undefined : 'soft'}
                title={lead?.title}
                onClick={() => lead ? onOpen(lead.slug) : onOpenSection(section.title)}
                sx={lead ? _styles.navHeader : _styles.navHeaderIndex}
              >
                <ListItemContent sx={_styles.navLabel}>{section.title}</ListItemContent>
                {lead?.new && <DocsNewChip />}
              </ListItemButton>
            </ListItem>

            {active && section.rows.map(row => {
              if (row.kind === 'page') {
                const childrenShown = row.doc.slug === currentSlug || row.children.some(doc => doc.slug === currentSlug);
                return (
                  <React.Fragment key={row.doc.slug}>
                    <DocsNavPage doc={row.doc} nested={!!row.doc.indent} selected={row.doc.slug === currentSlug} onOpen={onOpen} />
                    {childrenShown && row.children.map(doc => (
                      <DocsNavPage key={doc.slug} doc={doc} nested selected={doc.slug === currentSlug} onOpen={onOpen} />
                    ))}
                  </React.Fragment>
                );
              }
              const open = setsOpen[section.title] ?? true;
              return (
                <React.Fragment key='set'>
                  <ListItem>
                    <ListItemButton
                      data-docs-row
                      variant='soft'
                      aria-expanded={open}
                      onClick={() => setToggles({ slug: currentSlug, open: { ...setsOpen, [section.title]: !open } })}
                      sx={_styles.navPage}
                    >
                      <ListItemContent sx={_styles.navLabel}>{_setLabel(row.docs)}</ListItemContent>
                      <KeyboardArrowRightIcon sx={open ? _styles.navCaretOpen : _styles.navCaret} />
                    </ListItemButton>
                  </ListItem>
                  {open && row.docs.map(doc => (
                    <DocsNavPage key={doc.slug} doc={doc} nested selected={doc.slug === currentSlug} onOpen={onOpen} />
                  ))}
                </React.Fragment>
              );
            })}

          </React.Fragment>
        );
      })}
    </List>
  );
}


/**
 * Search results: title and section, then the best-matching question (else the summary) with the hits
 * in bold. While the search field has focus, the first result is marked as the Enter target.
 */
function DocsSearchResults(props: { hits: DocsHit[], words: string[], enterTarget: boolean, onOpen: (slug: SiteDocSlug) => void, onExitUp: () => void }) {

  const { onOpen, onExitUp } = props;

  // ArrowUp/ArrowDown move through the results; up from the first returns to the search field
  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-docs-hit]'));
    const next = buttons.findIndex(button => button === document.activeElement) + (event.key === 'ArrowDown' ? 1 : -1);
    if (next < 0) onExitUp();
    else buttons[Math.min(next, buttons.length - 1)]?.focus();
  }, [onExitUp]);

  if (!props.hits.length)
    return <Typography level='body-sm' sx={_styles.message}>No pages match.</Typography>;

  return (
    <List size='sm' onKeyDown={handleKeyDown} sx={_styles.hits}>
      {props.hits.map(({ doc, answer }, idx) => (
        <ListItem key={doc.slug}>
          <ListItemButton data-docs-hit variant={props.enterTarget && idx === 0 ? 'soft' : 'plain'} onClick={() => onOpen(doc.slug)} sx={_styles.hitButton}>
            <ListItemContent>
              <Box sx={_styles.hitHead}>
                <Typography level='title-sm' textColor='text.secondary' sx={_styles.hitSection}>{doc.section}</Typography>
                <KeyboardArrowRightIcon sx={_styles.hitChevron} />
                <Typography level='title-sm' textColor='primary.plainColor' noWrap>{_docLabel(doc)}</Typography>
                {props.enterTarget && idx === 0 && <Typography level='body-xs' sx={_styles.hitEnter}>↵</Typography>}
              </Box>
              <Typography level='body-sm' sx={_styles.clamp2}>{_highlight(answer ?? doc.summary, props.words)}</Typography>
            </ListItemContent>
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}


/** A page: title, summary as the lead, tier and update day, then the markdown */
function DocsPageView(props: { page: DocsPage, entry: DocsIndexEntry | undefined }) {
  const { page, entry } = props;
  const summary = page.summary || entry?.summary;

  // the body follows the chat text size
  const contentScaling = useUIContentScaling();
  const scaledTypographySx = useScaledTypographySx(contentScaling, false, false);

  return <>
    <Box sx={_styles.pageHead}>
      <Typography level='h3'>
        {page.title || entry?.title}
        {!!entry && (entry.new || entry.tier !== 'open') && (
          <Box component='span' sx={_styles.pageTitleChips}>
            {entry.new && <DocsNewChip />}
            <DocsTierChip tier={entry.tier} />
          </Box>
        )}
      </Typography>
      {!!summary && <Typography textColor='text.secondary' sx={scaledTypographySx}>{summary}</Typography>}
    </Box>
    <Divider sx={_styles.pageDivider} />
    <RenderMarkdownMemo key={page.slug} content={page.markdown} sx={scaledTypographySx} />
    {!!entry && <Typography level='body-xs' sx={_styles.pageFoot}>Updated {newsFormatDay(entry.updated)}</Typography>}
  </>;
}


/**
 * In-app reader for the big-agi.com docs, in the Preferences two-pane shape: search and the contents
 * tree on the left; the sections, a section's pages, search results, or a page on the right. A page is
 * its markdown twin, rendered with the app's markdown renderer; links to other docs pages navigate in
 * place, with back and forward.
 */
export function DocsReaderModal(props: { target: NewsDocsTarget }) {

  // state
  const [history, setHistory] = React.useState<{ stack: DocsView[], idx: number }>(() => ({ stack: [_viewFromTarget(props.target)], idx: 0 }));
  const [query, setQuery] = React.useState('');
  const [searchFocused, setSearchFocused] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const treeRef = React.useRef<HTMLUListElement>(null);

  // external state
  const isMobile = useIsMobile();
  const { data: index = null, isError: indexError } = useQuery({
    queryKey: ['news-docs-index', 'v1'],
    queryFn: ({ signal }) => _fetchDocsIndex(signal),
    staleTime: NewsConfig.docsStaleTimeMs,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // derived: the index
  const docs = index?.docs ?? null;
  const sections = React.useMemo(() => _docsSections(index), [index]);
  const docBySlug = React.useMemo(() => new Map((docs ?? []).map(doc => [doc.slug, doc])), [docs]);

  // derived: where we are
  const view = history.stack[history.idx];
  const canBack = history.idx > 0;
  const canForward = history.idx < history.stack.length - 1;
  const pageSlug = view.kind === 'page' ? view.slug : null;
  const pageEntry = pageSlug ? docBySlug.get(pageSlug) : undefined;
  const sectionTitle = view.kind === 'section' ? view.section : pageEntry?.section ?? null;

  // derived: search
  const { words, hits } = React.useMemo(() => {
    const words = _searchWords(query);
    return { words, hits: docs && words.length ? _docsSearch(docs, words) : [] };
  }, [docs, query]);
  const searching = words.length > 0;

  const { data: pageData, isPlaceholderData, isError: pageError } = useQuery({
    enabled: !!pageSlug,
    queryKey: ['news-docs-page', pageSlug],
    queryFn: ({ signal }) => _fetchDocsPage(pageSlug!, signal),
    placeholderData: keepPreviousData,
    staleTime: NewsConfig.docsStaleTimeMs,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // derived: the view on screen - while a page loads, the previous view stays up under a progress bar
  const viewReady = view.kind !== 'page' || pageError || (!!pageData && !isPlaceholderData);
  const [shownView, setShownView] = React.useState<DocsView>(view);
  if (viewReady && shownView !== view)
    setShownView(view);
  const shownPage = shownView.kind === 'page' && pageData?.slug === shownView.slug ? pageData : null;
  const shownSection = shownView.kind === 'section' ? shownView.section : null;
  const loading = !viewReady || (!docs && !indexError && (shownView.kind === 'section' || searching));


  // [effect] opened again from another entry point: navigate there
  const { target } = props;
  React.useEffect(() => {
    const to = _viewFromTarget(target);
    setQuery('');
    setHistory(h => _viewEquals(h.stack[h.idx], to) ? h : { stack: [...h.stack.slice(0, h.idx + 1), to], idx: h.idx + 1 });
  }, [target]);

  // [effect] initial focus: search on the desktop home, else the content for keyboard scrolling - one
  // tick late, after the opening click settles (a closing menu hands the focus back to its button)
  const focusSearchOnOpen = !isMobile && !props.target.slug;
  React.useEffect(() => {
    const timer = setTimeout(() => (focusSearchOnOpen ? searchRef.current : scrollRef.current)?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(timer);
  }, [focusSearchOnOpen]);

  // [effect] on a new view: scroll to the anchor once the (lazy) markdown has rendered, else to the top
  React.useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const anchor = !searching && shownPage && shownView.kind === 'page' ? shownView.anchor : undefined;
    if (!anchor) {
      container.scrollTop = 0;
      return;
    }
    let attempts = 60;
    let frame = 0;
    const tryScroll = () => {
      const heading = Array.from(container.querySelectorAll<HTMLElement>('h1, h2, h3, h4')).find(h => _headingId(h.textContent || '') === anchor);
      if (heading) heading.scrollIntoView({ block: 'start' });
      else if (--attempts > 0) frame = requestAnimationFrame(tryScroll);
    };
    tryScroll();
    return () => cancelAnimationFrame(frame);
  }, [searching, shownPage, shownView]);


  // handlers - navigation

  const navigate = React.useCallback((to: DocsView) => {
    setQuery('');
    setHistory(h => _viewEquals(h.stack[h.idx], to) ? h : { stack: [...h.stack.slice(0, h.idx + 1), to], idx: h.idx + 1 });
  }, []);

  const openPage = React.useCallback((slug: SiteDocSlug, anchor?: string) => {
    navigate({ kind: 'page', slug, anchor });
  }, [navigate]);

  const openSection = React.useCallback((title: string) => {
    navigate({ kind: 'section', section: title });
  }, [navigate]);

  const handleHome = React.useCallback(() => navigate({ kind: 'section', section: null }), [navigate]);

  const handleSectionCrumb = React.useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    if (sectionTitle) openSection(sectionTitle);
  }, [openSection, sectionTitle]);

  const handleBack = React.useCallback(() => {
    setQuery('');
    setHistory(h => ({ ...h, idx: Math.max(0, h.idx - 1) }));
  }, []);

  const handleForward = React.useCallback(() => {
    setQuery('');
    setHistory(h => ({ ...h, idx: Math.min(h.stack.length - 1, h.idx + 1) }));
  }, []);

  // links to docs pages (made absolute by _parseDocsPage) navigate in place; everything else keeps opening a new tab
  const handleClickCapture = React.useCallback((event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const anchor = event.target instanceof Element ? event.target.closest('a') : null;
    const target = anchor ? newsDocsLinkTarget(anchor.href) : null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    navigate(_viewFromTarget(target));
  }, [navigate]);


  // handlers - keys

  // '/' focuses search; Alt+Left/Right go back and forward - outside text fields
  const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]')) return;
    if (event.key === '/' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      searchRef.current?.focus();
    } else if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      if (event.key === 'ArrowLeft') handleBack();
      else handleForward();
    }
  }, [handleBack, handleForward]);

  // Esc clears before it closes; Enter opens the first result; ArrowDown enters the results, else the tree
  const handleSearchKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && query) {
      event.preventDefault();
      event.stopPropagation();
      setQuery('');
    } else if (event.key === 'Enter' && hits.length) {
      event.preventDefault();
      openPage(hits[0].doc.slug);
    } else if (event.key === 'ArrowDown' && hits.length) {
      event.preventDefault();
      scrollRef.current?.querySelector<HTMLElement>('[data-docs-hit]')?.focus();
    } else if (event.key === 'ArrowDown' && !searching && treeRef.current) {
      event.preventDefault();
      (treeRef.current.querySelector<HTMLElement>('[data-docs-row].Mui-selected') ?? treeRef.current.querySelector<HTMLElement>('[data-docs-row]'))?.focus();
    }
  }, [hits, openPage, query, searching]);

  const handleSearchFocus = React.useCallback(() => searchRef.current?.focus(), []);


  // title: back, forward, then Documentation > Section > Page
  const crumbs: React.ReactElement[] = [];
  if (searching)
    crumbs.push(<AppBreadcrumbs.Leaf key='search'><b>Search</b></AppBreadcrumbs.Leaf>);
  else {
    if (sectionTitle)
      crumbs.push(view.kind === 'page'
        ? <AppBreadcrumbs.Link key='section' color='neutral' textColor='text.primary' underline='hover' href='#' onClick={handleSectionCrumb}>{sectionTitle}</AppBreadcrumbs.Link>
        : <AppBreadcrumbs.Leaf key='section'><b>{sectionTitle}</b></AppBreadcrumbs.Leaf>);
    if (view.kind === 'page')
      crumbs.push(<AppBreadcrumbs.Leaf key='page'><b>{pageEntry ? _docLabel(pageEntry) : (pageData?.slug === view.slug && pageData.title) || view.slug}</b></AppBreadcrumbs.Leaf>);
  }
  const atHome = !searching && view.kind === 'section' && !view.section;

  const title = (
    <Box component='span' sx={_styles.titleBar}>
      <Tooltip title='Back (Alt+Left)'>
        <span><IconButton size='sm' disabled={!canBack} onClick={handleBack} sx={_styles.titleButton}><ArrowBackRoundedIcon /></IconButton></span>
      </Tooltip>
      <Tooltip title='Forward (Alt+Right)'>
        <span><IconButton size='sm' disabled={!canForward} onClick={handleForward} sx={_styles.titleButton}><ArrowForwardRoundedIcon /></IconButton></span>
      </Tooltip>
      <AppBreadcrumbs size='md' rootTitle={atHome ? 'Documentation' : <PhHouse titleAccess='Documentation' sx={_styles.titleHome} />} onRootClick={atHome ? undefined : handleHome}>
        {crumbs}
      </AppBreadcrumbs>
    </Box>
  );

  const pageUrl = view.kind !== 'page' ? BaseProduct.DocsBaseSite : `${BaseProduct.DocsBaseSite}/${view.slug}${view.anchor ? '#' + view.anchor : ''}`;


  // content: search results, a page, a section, or every section
  let content: React.ReactNode = null;
  if (searching)
    content = docs && <DocsSearchResults hits={hits} words={words} enterTarget={searchFocused} onOpen={openPage} onExitUp={handleSearchFocus} />;
  else if (shownView.kind === 'page')
    content = shownPage ? <DocsPageView page={shownPage} entry={docBySlug.get(shownPage.slug)} /> : (
      <Typography level='body-sm' sx={_styles.message}>This page could not be loaded. Use Open in browser to read it on big-agi.com.</Typography>
    );
  else if (indexError)
    content = (
      <Box sx={_styles.message}>
        <Typography level='body-sm'>The contents could not be loaded.</Typography>
        <Button size='sm' variant='soft' color='neutral' onClick={() => openPage(NewsConfig.docsFallbackSlug)}>Start here</Button>
      </Box>
    );
  else if (docs)
    content = shownSection
      ? <DocsSectionView docs={sections.find(section => section.title === shownSection)?.docs ?? []} onOpen={openPage} />
      : <DocsHomeView sections={sections} onOpenSection={openSection} onOpen={openPage} />;

  const contentPane = <>
    {loading && <LinearProgress size='sm' variant='plain' sx={_styles.progress} />}
    <Box ref={scrollRef} tabIndex={-1} onClickCapture={handleClickCapture} sx={_styles.scroller}>
      <Box sx={_styles.column}>{content}</Box>
    </Box>
  </>;

  const searchField = (
    <Input
      placeholder='Search docs'
      startDecorator={<SearchIcon />}
      value={query}
      onChange={event => setQuery(event.target.value)}
      onKeyDown={handleSearchKeyDown}
      onFocus={() => setSearchFocused(true)}
      onBlur={() => setSearchFocused(false)}
      slotProps={{ input: { ref: searchRef, 'aria-label': 'Search the docs' } }}
      sx={isMobile ? undefined : _styles.navSearch}
    />
  );

  return (
    <GoodModal
      open
      onClose={newsCloseDocs}
      title={title}
      fullscreen={isMobile || 'button'}
      unfilterBackdrop
      startButton={
        <Button variant='soft' color='neutral' endDecorator={<LaunchIcon />} component='a' href={pageUrl} target='_blank' rel='noopener'>
          Open in browser
        </Button>
      }
      sx={isMobile ? _styles.modalMobile : _styles.modalDesktop}
    >

      {isMobile ? (
        <Box sx={_styles.mobileBody} onKeyDown={handleKeyDown}>
          {searchField}
          <Select
            value={pageSlug}
            placeholder='Contents'
            onChange={(_event, value) => value && openPage(value)}
            indicator={<KeyboardArrowDownIcon />}
            slotProps={{ button: { sx: { fontWeight: 'lg' } }, listbox: { sx: { boxShadow: 'xl' } } }}
          >
            {sections.map(section => (
              <React.Fragment key={section.title}>
                <ListSubheader sticky>{section.title}</ListSubheader>
                {section.docs.map(doc => (
                  <Option key={doc.slug} value={doc.slug} label={_docLabel(doc)} sx={doc.indent || doc.setMember ? _styles.optionNested : undefined}>
                    <ListItemContent>{_docLabel(doc)}</ListItemContent>
                    {doc.new && <DocsNewChip />}
                  </Option>
                ))}
              </React.Fragment>
            ))}
          </Select>
          <Box sx={_styles.mobileContent}>{contentPane}</Box>
        </Box>
      ) : (
        <Box sx={_styles.body} onKeyDown={handleKeyDown}>
          <Box sx={_styles.nav}>
            {searchField}
            <DocsNavTree
              sections={sections}
              currentSlug={pageSlug}
              currentSection={view.kind === 'section' ? view.section : null}
              atHome={atHome}
              listRef={treeRef}
              onHome={handleHome}
              onOpen={openPage}
              onOpenSection={openSection}
              onExitUp={handleSearchFocus}
            />
          </Box>
          <Box sx={_styles.content}>{contentPane}</Box>
        </Box>
      )}

    </GoodModal>
  );
}
