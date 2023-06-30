import * as React from 'react';
import { shallow } from 'zustand/shallow';
import { useRouter } from 'next/router';

import { Box, Button, Card, CardContent, Container, IconButton, Sheet, Typography } from '@mui/joy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { AppLayout } from '~/common/layouts/AppLayout';
import { Brand } from '~/common/brand';
import { Link } from '~/common/components/Link';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { clientUtmSource } from '~/common/util/pwaUtils';
import { useAppStateStore } from '~/common/state/store-appstate';


// News

const incrementalVersion: number = 1;

interface NewsItem {
  versionName: string;
  text?: string | React.JSX.Element;
  items?: {
    text: string | React.JSX.Element;
  }[];
}

const NewsItems: NewsItem[] = [
  {
    versionName: '1.2.1',
    // text: '',
    items: [
      { text: <>New home page: <b><Link href={Brand.URIs.Home + clientUtmSource()} target='_blank'>{Brand.URIs.Home.replace('https://', '')}</Link></b></> },
      { text: 'Support 𝑓unction models' }, // (n)
      { text: <Box sx={{ display: 'flex', alignItems: 'center' }}>Goofy labs: experiments</Box> }, // ⚗️🧬🔬🥼 🥽🧪 <ScienceIcon sx={{ fontSize: 24, opacity: 0.5 }} />
    ],
  },
];


// Reach Hooks - show news / mark as seen

export function useShowNewsOnUpdate() {
  const { push } = useRouter();
  const { usageCount, lastSeenNewsVersion } = useAppStateStore(state => ({
    usageCount: state.usageCount,
    lastSeenNewsVersion: state.lastSeenNewsVersion,
  }), shallow);
  React.useEffect(() => {
    const isNewsOutdated = (lastSeenNewsVersion || 0) < incrementalVersion;
    if (isNewsOutdated && usageCount > 2) {
      // Disable for now
      push('/news').then(() => null);
    }
  }, [lastSeenNewsVersion, push, usageCount]);
}

function useMarkNewsAsSeen() {
  React.useEffect(() => {
    useAppStateStore.getState().setLastSeenNewsVersion(incrementalVersion);
  }, []);
}


export default function NewsPage() {
  const [lastNewsIdx, setLastNewsIdx] = React.useState<number>(0);

  // update the last seen news version
  useMarkNewsAsSeen();

  const news = NewsItems.filter((_, idx) => idx <= lastNewsIdx);
  const firstNews = news[0] ?? null;

  return (
    <AppLayout suspendAutoModelsSetup>

      <Sheet variant='soft' invertedColors sx={{
        // background: theme.vars.palette.background.level2,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        flexGrow: 1,
        overflowY: 'auto',
        minHeight: 96,
        p: { xs: 3, md: 6 },
        gap: 4,
      }}>

        <Typography level='display2'>
          New updates!
        </Typography>

        <Typography level='body1'>
          {capitalizeFirstLetter(Brand.Title.Base)} has been updated to version {firstNews?.versionName}. Enjoy what&apos;s new:
        </Typography>

        {!!news && <Container disableGutters maxWidth='sm'>
          {news?.map((item, idx) => {
            const firstCard = idx === 0;
            const hasCardAfter = news.length < NewsItems.length;
            const showExpander = hasCardAfter && (idx === news.length - 1);
            const addPadding = !firstCard || showExpander;
            return <Card key={'news-' + idx} sx={{ mb: 2, minHeight: 32 }}>
              <CardContent sx={{ position: 'relative', pr: addPadding ? 4 : 0 }}>
                {!!item.text && <Typography component='div' level='body1'>
                  {item.text}
                </Typography>}

                {!!item.items && (item.items.length > 0) && <ul style={{ marginTop: 8, marginBottom: 8, paddingInlineStart: 32 }}>
                  {item.items.map((item, idx) => <li key={idx}>
                    <Typography component='div' level='body1'>
                      {item.text}
                    </Typography>
                  </li>)}
                </ul>}

                {!firstCard && (
                  <Typography level='body2' sx={{ position: 'absolute', right: 0, top: 0 }}>
                    {item.versionName}
                  </Typography>
                )}

                {showExpander && (
                  <IconButton
                    variant='plain' size='sm'
                    onClick={() => setLastNewsIdx(idx + 1)}
                    sx={{ position: 'absolute', right: 0, bottom: 0, mr: -1, mb: -1 }}
                  >
                    <ExpandMoreIcon />
                  </IconButton>
                )}

              </CardContent>
            </Card>;
          })}
        </Container>}

        <Button variant='solid' color='neutral' size='lg' component={Link} href='/' noLinkStyle>
          Got it!
        </Button>

        {/*<Typography level='body1' sx={{ textAlign: 'center' }}>*/}
        {/*  Enjoy!*/}
        {/*  <br /><br />*/}
        {/*  -- The {Brand.Title.Base} Team*/}
        {/*</Typography>*/}

      </Sheet>

    </AppLayout>
  );
}