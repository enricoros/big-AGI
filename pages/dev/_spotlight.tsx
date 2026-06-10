import * as React from 'react';

import { Box, Button, Card, CardContent, Chip, Link, ToggleButtonGroup, Typography } from '@mui/joy';

import { withNextJSPerPageLayout } from '~/common/layout/withLayout';

import type { SpotlightFeedAnnouncement, SpotlightFeedChangelogGroup, SpotlightFeedTier } from '~/modules/spotlight/spotlight.feed';
import { useSpotlightFeedAnnouncements, useSpotlightFeedChangelog } from '~/modules/spotlight/spotlight.feed';


/**
 * Dev page to exercise the big-agi.com App News API end to end: live fetch,
 * Zod validation, mini-format rendering (bold, links, lists), remote images,
 * and Vimeo embeds. Not linked from anywhere - visit /dev/spotlight.
 */


// Render the body mini-format inline tokens: **bold** and [label](https://url)
const INLINE_PATTERN = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https:\/\/[^)\s]+\))/g;

function renderInline(text: string): React.ReactNode {
  return text.split(INLINE_PATTERN).map((part, partIdx) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
    const linkMatch = part.match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/);
    if (linkMatch)
      return <Link key={partIdx} href={linkMatch[2]} target='_blank' rel='noopener'>{linkMatch[1]}</Link>;
    return part;
  });
}

// Render the body mini-format blocks: \n\n paragraphs, \n list lines within a paragraph
function MiniFormatBody(props: { text: string }) {
  return <>
    {props.text.split('\n\n').map((paragraph, paragraphIdx) => (
      <Typography key={paragraphIdx} level='body-md' sx={{ mt: 1 }}>
        {paragraph.split('\n').map((line, lineIdx) => (
          <React.Fragment key={lineIdx}>
            {lineIdx > 0 && <br />}
            {renderInline(line)}
          </React.Fragment>
        ))}
      </Typography>
    ))}
  </>;
}


const _categoryColors: Record<string, 'primary' | 'success' | 'neutral'> = {
  launch: 'primary',
  upgrade: 'success',
  tip: 'neutral',
};

function AnnouncementCard(props: { announcement: SpotlightFeedAnnouncement }) {
  const { announcement } = props;
  return (
    <Card variant='outlined'>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {!!announcement.category && (
            <Chip size='sm' color={_categoryColors[announcement.category] || 'neutral'} variant='soft'>{announcement.category}</Chip>
          )}
          <Typography level='title-lg'>{announcement.title}</Typography>
          {!!announcement.date && <Typography level='body-xs' sx={{ ml: 'auto' }}>{announcement.date}</Typography>}
        </Box>

        {!!announcement.vimeoId && (
          <Box
            component='iframe'
            src={`https://player.vimeo.com/video/${announcement.vimeoId}`}
            allow='autoplay; fullscreen; picture-in-picture'
            sx={{ width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: 'md', mt: 1 }}
          />
        )}

        {announcement.imageUrls.map((imageUrl) => (
          <Box key={imageUrl} component='img' src={imageUrl} alt={announcement.title} sx={{ maxWidth: '100%', borderRadius: 'md', mt: 1 }} />
        ))}

        {!!announcement.body && <MiniFormatBody text={announcement.body} />}

        {!!announcement.url && (
          <Link href={announcement.url} target='_blank' rel='noopener' sx={{ mt: 1 }}>Learn more</Link>
        )}

        <Typography level='body-xs' sx={{ mt: 1, fontFamily: 'code', opacity: 0.5 }}>
          id: {announcement.id} - for: {announcement.audience?.join(', ') || 'everyone'}
        </Typography>
      </CardContent>
    </Card>
  );
}


function ChangelogGroupBlock(props: { group: SpotlightFeedChangelogGroup }) {
  const { group } = props;
  return (
    <Box>
      <Typography level='title-sm'>{group.label}, {group.year}</Typography>
      {group.items.map((item, itemIdx) => (
        <Typography key={itemIdx} level='body-sm' sx={{ ml: 2 }}>- {renderInline(item)}</Typography>
      ))}
    </Box>
  );
}


function SectionStatus(props: { isLoading: boolean, isError: boolean, count: number | null, noun: string }) {
  return (
    <Typography level='body-sm' sx={{ mb: 1 }}>
      {props.isLoading ? 'loading...' : props.isError ? 'ERROR - see console' : `${props.count} ${props.noun}`}
    </Typography>
  );
}


function AppDevSpotlight() {

  // state: which tier we impersonate - exercises the server-side ?tier= filter
  const [tier, setTier] = React.useState<SpotlightFeedTier>('open');

  // external state: live fetches from the big-agi.com App News API
  const { announcements, isLoading: announcementsLoading, isError: announcementsError } = useSpotlightFeedAnnouncements(true, tier);
  const { changelogGroups, isLoading: changelogLoading, isError: changelogError } = useSpotlightFeedChangelog();

  return (
    <Box sx={{ display: 'grid', gap: 3, my: 3 }}>

      <Typography level='h3'>Spotlight Feed - end-to-end render test</Typography>
      <Typography level='body-sm'>
        Live from <Link href='https://big-agi.com/api/app/v1/announcements' target='_blank'>/api/app/v1/announcements</Link> and{' '}
        <Link href='https://big-agi.com/api/app/v1/changelog' target='_blank'>/api/app/v1/changelog</Link>.
        Verifies: CORS fetch, Zod contract, mini-format (bold, links, lists), remote images, Vimeo embeds.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, alignItems: 'start' }}>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography level='title-lg'>Announcements</Typography>
              <ToggleButtonGroup size='sm' value={tier} onChange={(_event, newTier) => newTier && setTier(newTier as SpotlightFeedTier)} sx={{ ml: 'auto' }}>
                <Button value='open'>open</Button>
                <Button value='free'>free</Button>
                <Button value='pro'>pro</Button>
              </ToggleButtonGroup>
            </Box>
            <SectionStatus isLoading={announcementsLoading} isError={announcementsError} count={announcements?.length ?? null} noun='entries' />
            <Box sx={{ display: 'grid', gap: 2 }}>
              {announcements?.map((announcement) => <AnnouncementCard key={announcement.id} announcement={announcement} />)}
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography level='title-lg'>Changelog</Typography>
            <SectionStatus isLoading={changelogLoading} isError={changelogError} count={changelogGroups?.length ?? null} noun='date groups' />
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              {changelogGroups?.map((group) => <ChangelogGroupBlock key={`${group.year}-${group.label}`} group={group} />)}
            </Box>
          </CardContent>
        </Card>

      </Box>
    </Box>
  );
}


export default withNextJSPerPageLayout({ type: 'container' }, () => <AppDevSpotlight />);
