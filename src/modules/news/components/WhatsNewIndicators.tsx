import * as React from 'react';

import { Badge, Box, Chip, Link, ListItem, ListItemButton, ListItemContent, ListItemDecorator, MenuItem, Typography } from '@mui/joy';
import LaunchIcon from '@mui/icons-material/Launch';

import { BaseProduct } from '~/common/app.release';
import { PhBookOpenText } from '~/common/components/icons/phosphor/PhBookOpenText';
import { OptimaPanelGroupedList } from '~/common/layout/optima/panel/OptimaPanelGroupedList';
import { optimaClosePanel } from '~/common/layout/optima/useOptima';
import { useIsMobile } from '~/common/components/useMatchMedia';

import { NewsConfig } from '../news.config';
import { NewsPlatform, useNewsAudience } from '../news.platform';
import { newsBuildIsBehind, newsFormatChanges, newsFormatCount, newsFormatDay, newsHeadlines, newsInterceptDocsLinks, newsOpenDocs, newsOpenWhatsNew, useNews, useNewsModals } from '../useNews';

import { DocsReaderModal } from './DocsReaderModal';
import { WhatsNewModal } from './WhatsNewModal';


/**
 * Entry points to What's New and the docs, self-contained so each codeline places them with one line.
 * Changelog news is passive (neutral, never animated); unseen announcements use the accent color.
 * Only what this build has is counted.
 */


/** What's New and the docs reader. Mount once with the app modals. */
export function NewsModals() {
  const { whatsNewOpen, docsTarget } = useNewsModals();
  const { off } = useNewsAudience();

  // [effect] docs links anywhere in the app open the reader
  React.useEffect(() => off ? undefined : newsInterceptDocsLinks(), [off]);

  return <>
    {whatsNewOpen && <WhatsNewModal />}
    {!!docsTarget && <DocsReaderModal target={docsTarget} />}
  </>;
}


function NewCount(props: { changelog: number, changelogMore: boolean, announcements: number }) {
  return props.announcements > 0 ? <Chip size='sm' color='accent' variant='solid'>{newsFormatCount(props.announcements)}</Chip>
    : props.changelog > 0 ? <Typography level='body-xs'>{newsFormatCount(props.changelog, props.changelogMore)} new</Typography>
      : null;
}


/** Accent dot over a nav icon while an announcement is unseen; the changelog is passive and never dots */
export function WhatsNewNavDot(props: { children: React.ReactElement }) {
  // build-time gate: with announcements off, the nav runs no news hooks at all
  return NewsConfig.indicatorNavDot && NewsConfig.announcementsEnabled
    ? <AnnouncementsNavDot>{props.children}</AnnouncementsNavDot>
    : props.children;
}

function AnnouncementsNavDot(props: { children: React.ReactElement }) {
  const { announcementsNewCount } = useNews(false);
  return !announcementsNewCount ? props.children : (
    <Badge size='sm' color='accent' variant='solid' badgeInset='14%'>
      {props.children}
    </Badge>
  );
}


/** "What's New" menu item; hidden when the operator turned the feeds off */
export function WhatsNewMenuItem() {
  const { off } = useNewsAudience();
  if (off)
    return null;
  return (
    <MenuItem onClick={newsOpenWhatsNew}>
      <ListItemDecorator />
      <ListItemContent>What&apos;s New</ListItemContent>
    </MenuItem>
  );
}


/** "Documentation" menu item: the in-app reader, or big-agi.com in a tab when the operator turned remote feeds off */
export function DocsMenuItem() {
  const { off } = useNewsAudience();
  return off ? (
    <MenuItem component='a' href={BaseProduct.DocsBaseSite} target='_blank' rel='noopener'>
      <ListItemDecorator><PhBookOpenText /></ListItemDecorator>
      Documentation
      <LaunchIcon sx={{ ml: 'auto', fontSize: 16, opacity: 0.7 }} />
    </MenuItem>
  ) : (
    <MenuItem onClick={() => newsOpenDocs()}>
      <ListItemDecorator><PhBookOpenText /></ListItemDecorator>
      Documentation
    </MenuItem>
  );
}


/**
 * Side panel rows. Desktop: What's New, only while something is new. Mobile, where the panel holds
 * the only entry points: What's New and Documentation, always.
 */
export function WhatsNewPanelRow() {

  // external state
  const isMobile = useIsMobile();
  const { off, changelogNewCount, changelogNewMore, announcementsNewCount } = useNews(false);

  if (!isMobile && (!NewsConfig.indicatorPanelRow || (!changelogNewCount && !announcementsNewCount)))
    return null;

  const handleOpenWhatsNew = () => {
    if (isMobile) optimaClosePanel();
    newsOpenWhatsNew();
  };

  const handleOpenDocs = () => {
    optimaClosePanel();
    newsOpenDocs();
  };

  return (
    <OptimaPanelGroupedList marginTopAuto>

      {!off && (
        <ListItem>
          <ListItemButton onClick={handleOpenWhatsNew}>
            <ListItemDecorator />
            <ListItemContent>What&apos;s New</ListItemContent>
            <NewCount changelog={changelogNewCount} changelogMore={changelogNewMore} announcements={announcementsNewCount} />
          </ListItemButton>
        </ListItem>
      )}

      {isMobile && (
        <ListItem>
          {off ? (
            <ListItemButton component='a' href={BaseProduct.DocsBaseSite} target='_blank' rel='noopener'>
              <ListItemDecorator><PhBookOpenText /></ListItemDecorator>
              <ListItemContent>Documentation</ListItemContent>
              <LaunchIcon sx={{ fontSize: 16, opacity: 0.7 }} />
            </ListItemButton>
          ) : (
            <ListItemButton onClick={handleOpenDocs}>
              <ListItemDecorator><PhBookOpenText /></ListItemDecorator>
              <ListItemContent>Documentation</ListItemContent>
            </ListItemButton>
          )}
        </ListItem>
      )}

    </OptimaPanelGroupedList>
  );
}


/** Muted line under the persona selector of an empty chat: what's new, else how far behind this build is */
export function WhatsNewEmptyChatLine() {
  const { changelogNewItems, changelogNewCount, changelogNewMore, changelogMark, changelogAfterBuildCount } = useNews(false);
  if (!NewsConfig.indicatorEmptyChat)
    return null;

  let text: string | null = null;
  if (changelogNewCount && changelogMark) {
    // headlines: 'New: Haiku 5.5, Claude Code, +3' - the count when no line yields a headline
    const headlines = NewsConfig.emptyChatLine === 'headlines' ? newsHeadlines(changelogNewItems, 2) : [];
    const rest = changelogNewCount - headlines.length;
    text = headlines.length ? `New: ${headlines.join(', ')}${changelogNewMore ? ', and more' : rest > 0 ? `, +${rest}` : ''}`
      : `${newsFormatChanges(changelogNewCount, changelogNewMore)} since ${newsFormatDay(changelogMark.day)}`;
  } else if (changelogAfterBuildCount && newsBuildIsBehind())
    text = `${newsFormatChanges(changelogAfterBuildCount)} since this build. ${NewsPlatform.afterBuildHint}`;
  if (!text)
    return null;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
      <Link component='button' level='body-sm' color='neutral' underline='hover' onClick={newsOpenWhatsNew}>
        {text}
      </Link>
    </Box>
  );
}
