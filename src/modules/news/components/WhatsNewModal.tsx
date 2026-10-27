import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Alert, Box, Button, Chip, Divider, Link, List, ListDivider, ListItem, ListItemButton, ListItemContent, ListItemDecorator, ListSubheader, Option, Select, Typography } from '@mui/joy';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import CircleIcon from '@mui/icons-material/Circle';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LaunchIcon from '@mui/icons-material/Launch';

import type { SiteDocSlug } from '~/common/gen/com.site.docs.slug';
import { BaseProduct, Release } from '~/common/app.release';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { LiteVideoEmbed } from '~/common/components/LiteVideoEmbed';
import { useIsMobile } from '~/common/components/useMatchMedia';

import type { NewsAnnouncement, NewsChangelogGroup } from '../news.feed';
import { NewsPlatform } from '../news.platform';
import { newsAnnouncementIsUnseen, newsChangelogSplit, newsSeenRewind, useNewsSeenStore } from '../store-news-seen';
import { newsBuildDay, newsCloseWhatsNew, newsFormatChanges, newsFormatCount, newsFormatDay, newsOpenDocs, useNews } from '../useNews';


const _styles = {

  // the dialog sits on level1; the content is one surface higher (popup) and scrolls

  // desktop, changelog only: the dialog at its default size, the content edge to edge
  modalOnePane: {
    backgroundColor: 'background.level1',
  },
  pane: {
    mx: 'calc(-1 * var(--Card-padding))',
    px: 'var(--Card-padding)',
    py: 1,
    minHeight: 'max(420px, 40svh)',
    maxHeight: 'min(72svh, 760px)',
    overflowY: 'auto',
    outline: 'none',
    backgroundColor: 'background.popup',
    borderRadius: 'lg',
    boxShadow: 'md',
  },

  // desktop, with announcements: the nav list, then the card running to the right edge
  modalTwoPane: {
    backgroundColor: 'background.level1',
    width: 'min(780px, 94vw)',
    maxWidth: 'min(780px, 94vw)',
  },
  twoPane: {
    flex: 1,
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: '192px minmax(0, 1fr)',
    gridTemplateRows: 'minmax(0, 1fr)',
    mx: 'calc(-1 * var(--Card-padding))',
  },
  navList: {
    height: '100%',
    py: 2,
    overflowY: 'auto',
    '--ListItem-minHeight': '2.25rem',
  },
  navButton: {
    pl: 2,
    border: 0,
    backgroundColor: 'transparent',
    '&.Mui-selected': {
      boxShadow: 'inset 4px 0 0 0 var(--joy-palette-primary-solidBg)',
      color: 'primary.softColor',
    },
  },
  paneCard: {
    backgroundColor: 'background.popup',
    borderRadius: 'lg',
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    boxShadow: 'md',
    minWidth: 0,
    minHeight: 'max(490px, 45svh)',
    maxHeight: 'min(72svh, 760px)',
    overflowY: 'auto',
    px: 'var(--Card-padding)',
    outline: 'none',
    zIndex: 1,
  },

  // mobile: fullscreen, the content fills
  modalMobile: {
    backgroundColor: 'background.level1',
    minHeight: 0,
  },
  paneMobile: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    mx: 'calc(-1 * var(--Card-padding))',
    px: 'var(--Card-padding)',
    outline: 'none',
    backgroundColor: 'background.popup',
    boxShadow: 'xs',
  },

  // **bold** runs: the accent marker, as on big-agi.com/changes
  marked: {
    '& strong': {
      backgroundColor: 'accent.solidBg',
      color: 'accent.solidColor',
      fontWeight: 'xl',
      px: 0.5,
      boxDecorationBreak: 'clone',
      WebkitBoxDecorationBreak: 'clone',
    },
  },

  // the ledger: the date in a narrow column, then the day's items as plain lines
  ledger: {
    py: 0.5,
  },
  year: {
    '--Divider-childPosition': '0%',
    mt: 2,
    mb: 1,
    fontSize: 'md',
    fontWeight: 'xl',
    color: 'text.primary',
  },
  day: {
    display: 'grid',
    gridTemplateColumns: '3.75rem minmax(0, 1fr)',
    columnGap: 2,
    py: 1.25,
    fontSize: 'sm',
    lineHeight: 1.5,
  },
  dayDate: {
    fontSize: 'inherit',
    lineHeight: 'inherit',
    fontWeight: 'lg',
    color: 'text.tertiary',
    whiteSpace: 'nowrap',
  },
  dayItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0.75,
    color: 'text.primary',
    // each item behind a dash, wrapped lines hanging under the text
    '& > div': {
      position: 'relative',
      pl: '1em',
    },
    '& > div::before': {
      content: '"-"',
      position: 'absolute',
      left: 0,
      color: 'text.tertiary',
    },
  },
  seenDivider: {
    my: 1,
    fontSize: 'xs',
    color: 'text.tertiary',
  },
  afterBuild: {
    mt: 2,
    alignItems: 'flex-start',
  },
  buttons: {
    display: 'flex',
    justifyContent: 'center',
    py: 2,
  },

  footer: {
    display: 'flex',
    gap: 1,
    alignItems: 'center',
  },

} as const;

const _DEV_REWIND_DAYS = [1, 7, 30] as const;
const _SELECT_CHANGELOG = ':changelog'; // the mobile Select's value for the changelog


/// Mini-format: plain text with `**bold**` runs, `[label](https://url)` links, and "- " / "1. " list
/// lines. Never HTML. Same tokenizer as the website's renderer (AppNewsText).

const _INLINE_PATTERN = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
const _LINK_PATTERN = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/;
const _LIST_LINE_PATTERN = /^(?:- |\d+\. )/;

/** One line -> React nodes; everything but bold runs and links passes through verbatim */
function _renderInline(text: string): React.ReactNode {
  const parts = text.split(_INLINE_PATTERN);
  if (parts.length <= 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    const linkMatch = part.match(_LINK_PATTERN);
    if (linkMatch)
      return <Link key={i} href={linkMatch[2]} target='_blank' rel='noopener'>{linkMatch[1]}</Link>;
    return part;
  });
}

/** A body: `\n\n`-separated paragraphs; a paragraph whose lines are all list lines renders as a list */
function NewsBody(props: { body: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, ..._styles.marked }}>
      {props.body.split('\n\n').map((paragraph, i) => {
        const lines = paragraph.split('\n');
        if (lines.every(line => _LIST_LINE_PATTERN.test(line)))
          return (
            <Box key={i} component={/^\d/.test(lines[0]) ? 'ol' : 'ul'} sx={{ m: 0, pl: 2.5 }}>
              {lines.map((line, j) => <li key={j}>{_renderInline(line.replace(_LIST_LINE_PATTERN, ''))}</li>)}
            </Box>
          );
        return <Box key={i} component='p' sx={{ m: 0 }}>{_renderInline(paragraph)}</Box>;
      })}
    </Box>
  );
}


/// Changelog

function ChangelogDay(props: { day: NewsChangelogGroup }) {
  const { day } = props;
  return (
    <Box sx={_styles.day}>
      <Typography component='time' dateTime={day.date} sx={_styles.dayDate}>
        {newsFormatDay(day.date)}
      </Typography>
      <Box sx={_styles.dayItems}>
        {day.items.map(item => {
          const docsSlug = item.docs?.[0];
          return (
            <div key={item.id}>
              {_renderInline(item.text)}
              {!!docsSlug && (
                // the feed lists the website's slugs: the same set SiteDocSlug is generated from
                <Link component='button' level='body-sm' underline='hover' onClick={() => newsOpenDocs(docsSlug as SiteDocSlug)} sx={{ ml: 1 }}>
                  Docs
                </Link>
              )}
            </div>
          );
        })}
      </Box>
    </Box>
  );
}


/** Days, newest first, with a year header for past years; `seenFrom` is the first already-seen day */
function ChangelogLedger(props: { days: NewsChangelogGroup[], seenFrom?: number }) {
  const { days, seenFrom = -1 } = props;
  const thisYear = String(new Date().getFullYear());
  return (
    <Box sx={{ ..._styles.ledger, ..._styles.marked }}>
      {days.map((day, idx) => {
        const year = day.date.slice(0, 4);
        return (
          <React.Fragment key={day.date || idx}>
            {idx === seenFrom && <Divider sx={_styles.seenDivider}>Already seen</Divider>}
            {!!year && year !== thisYear && year !== days[idx - 1]?.date.slice(0, 4) && <Divider sx={_styles.year}>{year}</Divider>}
            <ChangelogDay day={day} />
          </React.Fragment>
        );
      })}
    </Box>
  );
}


/**
 * The changelog pane. On top, folded: days this build does not have yet. Then the days it has: new
 * since the watermark first, seen days folded behind one button, then older pages on request.
 */
function ChangelogPane(props: {
  split: ReturnType<typeof newsChangelogSplit>, // against the watermark at open
  loaded: boolean,
  error: boolean,
  afterBuild: NewsChangelogGroup[],             // days newer than this build
  hasOlder: boolean,
  loadingOlder: boolean,
  onLoadOlder: () => void,
}) {

  const { fresh, seen } = props.split;

  // state
  const [showAfterBuild, setShowAfterBuild] = React.useState(false);
  const [showSeen, setShowSeen] = React.useState(false);

  // derived
  const collapsed = fresh.length > 0 && !showSeen;
  const days = React.useMemo(() => collapsed ? fresh : [...fresh, ...seen], [collapsed, fresh, seen]);
  const seenFrom = !collapsed && fresh.length > 0 && seen.length > 0 ? fresh.length : -1;
  const afterBuildCount = props.afterBuild.reduce((sum, group) => sum + group.items.length, 0);
  const buildDay = newsBuildDay();


  if (!props.loaded || (!days.length && !afterBuildCount))
    return (
      <Typography level='body-sm' sx={{ py: 2 }}>
        {props.loaded || props.error ? 'The changelog is not available right now.' : 'Loading...'}
      </Typography>
    );

  return <>

    {afterBuildCount > 0 && (
      <Alert
        variant='soft'
        color='neutral'
        endDecorator={
          <Button size='sm' variant='plain' color='neutral' endDecorator={showAfterBuild ? <ExpandLessIcon /> : <ExpandMoreIcon />} onClick={() => setShowAfterBuild(on => !on)}>
            {showAfterBuild ? 'Hide' : 'Show'}
          </Button>
        }
        sx={_styles.afterBuild}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography level='title-sm'>
            {newsFormatChanges(afterBuildCount)} since this build{buildDay && ` (${newsFormatDay(buildDay)})`}
          </Typography>
          <Typography level='body-xs'>{NewsPlatform.afterBuildHint}</Typography>
          {showAfterBuild && <ChangelogLedger days={props.afterBuild} />}
        </Box>
      </Alert>
    )}

    <ChangelogLedger days={days} seenFrom={seenFrom} />

    {collapsed && seen.length > 0 ? (
      <Box sx={_styles.buttons}>
        <Button variant='plain' color='neutral' endDecorator={<ExpandMoreIcon />} onClick={() => setShowSeen(true)}>
          Show {seen.length} earlier {seen.length === 1 ? 'day' : 'days'}
        </Button>
      </Box>
    ) : props.hasOlder && (
      <Box sx={_styles.buttons}>
        <Button variant='plain' color='neutral' loading={props.loadingOlder} onClick={() => props.onLoadOlder()}>
          Show earlier days
        </Button>
      </Box>
    )}

  </>;
}


/// Announcements

/** One announcement: media, body, learn-more link */
function AnnouncementPane(props: { announcement: NewsAnnouncement }) {
  const { announcement } = props;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, py: 2 }}>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography level='title-lg'>{announcement.title}</Typography>
        {!!announcement.category && <Chip size='sm' variant='soft' color={announcement.category === 'launch' ? 'primary' : 'neutral'}>{announcement.category}</Chip>}
        {!!announcement.channel && <Chip size='sm' variant='outlined' color='neutral'>Preview</Chip>}
        <Typography level='body-xs' sx={{ ml: 'auto' }}>{newsFormatDay(announcement.date)}</Typography>
      </Box>

      {announcement.media?.map((media) => media.type === 'video' ? (
        <LiteVideoEmbed key={media.provider + media.id} platform={media.provider} videoId={media.id} title={announcement.title} responsive rounded />
      ) : (
        // plain <img>: absolute URLs, CORS-open
        <Box key={media.src} component='img' src={media.src} alt={media.alt ?? announcement.title} loading='lazy' sx={{ display: 'block', maxWidth: '100%', borderRadius: 'md' }} />
      ))}

      <NewsBody body={announcement.text} />

      {!!announcement.url && (
        <Link href={announcement.url} target='_blank' rel='noopener' level='body-sm' sx={{ alignSelf: 'flex-start' }}>
          Learn more
        </Link>
      )}

    </Box>
  );
}


/**
 * What's New hub: a dated ledger of the changelog (passive); announcements (attention) add a left
 * list, in the Preferences two-pane shape. What is new is measured against the watermark at open;
 * the changelog counts as seen as soon as it loads, so the indicators clear on open.
 */
export function WhatsNewModal() {

  // external state
  const isMobile = useIsMobile();
  const { changelogGroups, changelogError, changelogAfterBuild, changelogHasOlder, changelogLoadingOlder, changelogLoadOlder, announcements } = useNews(true);
  const { announcementsSince, announcementIds } = useNewsSeenStore(useShallow(state => ({ announcementsSince: state.announcementsSince, announcementIds: state.announcementIds })));

  // state - unseen announcements call for attention, so they open first; null: the changelog
  const [markAtOpen] = React.useState(() => useNewsSeenStore.getState().changelog);
  const [selectedId, setSelectedId] = React.useState<string | null>(() =>
    announcements?.find(announcement => newsAnnouncementIsUnseen(announcement, useNewsSeenStore.getState()))?.id ?? null);
  const paneRef = React.useRef<HTMLDivElement>(null);

  // derived
  const changelogSplit = React.useMemo(() => newsChangelogSplit(changelogGroups ?? [], markAtOpen, changelogHasOlder), [changelogGroups, changelogHasOlder, markAtOpen]);
  const selectedAnnouncement = (selectedId !== null && announcements?.find(announcement => announcement.id === selectedId)) || null;
  const hasNav = !!announcements?.length;

  // [effect] the changelog counts as seen once loaded
  React.useEffect(() => {
    if (changelogGroups)
      useNewsSeenStore.getState().markChangelogSeen(changelogGroups);
  }, [changelogGroups]);

  // [effect] opening an announcement marks it seen
  const selectedAnnouncementId = selectedAnnouncement?.id;
  React.useEffect(() => {
    if (selectedAnnouncementId)
      useNewsSeenStore.getState().markAnnouncementSeen(selectedAnnouncementId);
  }, [selectedAnnouncementId]);

  // [effect] the pane takes the initial focus, for keyboard scrolling - one tick late, after the
  // opening click settles (a closing menu hands the focus back to its button)
  React.useEffect(() => {
    const timer = setTimeout(() => paneRef.current?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(timer);
  }, []);

  // [effect] a new selection starts at the top
  React.useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = 0;
  }, [selectedId]);


  // handlers

  const handleOpenDocs = React.useCallback(() => {
    newsCloseWhatsNew();
    newsOpenDocs();
  }, []);

  const handleRewind = React.useCallback((days: number) => {
    newsSeenRewind(days);
    newsCloseWhatsNew();
  }, []);


  const navButton = (id: string | null, label: string, unseen: boolean, newCount: number, newMore: boolean) => (
    <ListItem key={id ?? _SELECT_CHANGELOG}>
      <ListItemButton
        selected={id === selectedId}
        color={id === selectedId ? 'primary' : undefined}
        variant={id === selectedId ? undefined : 'soft'}
        onClick={() => setSelectedId(id)}
        sx={_styles.navButton}
      >
        <ListItemContent>
          <Typography level='inherit' noWrap fontWeight={unseen ? 'lg' : undefined}>{label}</Typography>
        </ListItemContent>
        {unseen && <ListItemDecorator sx={{ minInlineSize: 0 }}><CircleIcon color='primary' sx={{ fontSize: 8 }} /></ListItemDecorator>}
        {newCount > 0 && <Typography level='body-xs'>{newsFormatCount(newCount, newMore)} new</Typography>}
      </ListItemButton>
    </ListItem>
  );

  const paneContent = selectedAnnouncement ? (
    <AnnouncementPane key={selectedAnnouncement.id} announcement={selectedAnnouncement} />
  ) : (
    <ChangelogPane
      split={changelogSplit}
      loaded={!!changelogGroups}
      error={changelogError}
      afterBuild={changelogAfterBuild}
      hasOlder={changelogHasOlder}
      loadingOlder={changelogLoadingOlder}
      onLoadOlder={changelogLoadOlder}
    />
  );

  return (
    <GoodModal
      open
      onClose={newsCloseWhatsNew}
      title={<>
        What&apos;s new
        {changelogSplit.count > 0 && (
          <Chip size='sm' variant='soft' color='neutral' sx={{ ml: 1 }}>
            {newsFormatCount(changelogSplit.count, changelogSplit.more)} new
          </Chip>
        )}
      </>}
      strongerTitle
      titleEndDecorator={Release.IsNodeDevBuild && (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {_DEV_REWIND_DAYS.map(days => (
            <Chip key={days} size='sm' variant='outlined' color='neutral' onClick={() => handleRewind(days)}>
              -{days}d
            </Chip>
          ))}
        </Box>
      )}
      fullscreen={isMobile}
      unfilterBackdrop
      startButton={
        <Box sx={_styles.footer}>
          <Button variant='soft' color='neutral' startDecorator={<AutoStoriesOutlinedIcon />} onClick={handleOpenDocs}>
            Documentation
          </Button>
          {!isMobile && (
            <Button variant='soft' color='neutral' endDecorator={<LaunchIcon />} component='a' href={BaseProduct.NewsSite} target='_blank' rel='noopener'>
              Full changelog
            </Button>
          )}
        </Box>
      }
      sx={isMobile ? _styles.modalMobile : hasNav ? _styles.modalTwoPane : _styles.modalOnePane}
    >

      {isMobile ? <>
        {hasNav && (
          <Select value={selectedId ?? _SELECT_CHANGELOG} onChange={(_event, value) => value && setSelectedId(value === _SELECT_CHANGELOG ? null : value)}>
            {announcements.map(announcement => <Option key={announcement.id} value={announcement.id}>{announcement.title}</Option>)}
            <Option value={_SELECT_CHANGELOG}>Changelog</Option>
          </Select>
        )}
        <Box ref={paneRef} tabIndex={-1} sx={_styles.paneMobile}>{paneContent}</Box>
      </> : !hasNav ? (
        <Box ref={paneRef} tabIndex={-1} sx={_styles.pane}>{paneContent}</Box>
      ) : (
        <Box sx={_styles.twoPane}>
          <List size='sm' sx={_styles.navList}>
            <ListSubheader>Announcements</ListSubheader>
            {announcements.map(announcement => navButton(
              announcement.id,
              announcement.title,
              newsAnnouncementIsUnseen(announcement, { announcementsSince, announcementIds }),
              0,
              false,
            ))}
            <ListDivider />
            {navButton(null, 'Changelog', false, changelogSplit.count, changelogSplit.more)}
          </List>
          <Box ref={paneRef} tabIndex={-1} sx={_styles.paneCard}>{paneContent}</Box>
        </Box>
      )}

    </GoodModal>
  );
}
