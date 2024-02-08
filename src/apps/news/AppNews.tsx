import * as React from 'react';
import { keyframes } from '@emotion/react';
import NextImage from 'next/image';
import TimeAgo from 'react-timeago';

import { AspectRatio, Box, Button, Card, CardContent, CardOverflow, Container, IconButton, Typography } from '@mui/joy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { Brand } from '~/common/app.config';
import { Link } from '~/common/components/Link';
import { ROUTE_INDEX } from '~/common/app.routes';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { cssRainbowColorKeyframes } from '~/common/app.theme';

import { NewsItems, newsRoadmapCallout } from './news.data';

// number of news items to show by default, before the expander
const DEFAULT_NEWS_COUNT = 3;

export const cssColorKeyframes = keyframes`
    0%, 100% {
        color: #636B74; /* Neutral main color (500) */
    }
    25% {
        color: #12467B; /* Primary darker shade (700) */
    }
    50% {
        color: #0B6BCB; /* Primary main color (500) */
    }
    75% {
        color: #083e75; /* Primary lighter shade (300) */
    }`;


export function AppNews() {
  // state
  const [lastNewsIdx, setLastNewsIdx] = React.useState<number>(DEFAULT_NEWS_COUNT - 1);

  // news selection
  const news = NewsItems.filter((_, idx) => idx <= lastNewsIdx);
  const firstNews = news[0] ?? null;

  return (

    <Box sx={{
      flexGrow: 1,
      overflowY: 'auto',
      display: 'flex', justifyContent: 'center',
      p: { xs: 3, md: 6 },
    }}>

      <Box sx={{
        my: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>

        <Typography level='h1' sx={{ fontSize: '2.9rem', mb: 4 }}>
          Welcome to {Brand.Title.Base} <Box component='span' sx={{ animation: `${cssColorKeyframes} 10s infinite`, zIndex: 1 }}>{firstNews?.versionCode}</Box>!
        </Typography>

        <Typography sx={{ mb: 2 }} level='title-sm'>
          {capitalizeFirstLetter(Brand.Title.Base)} has been updated to version {firstNews?.versionCode}
        </Typography>

        <Box sx={{ mb: 5 }}>
          <Button
            variant='solid' color='primary' size='lg'
            component={Link} href={ROUTE_INDEX} noLinkStyle
            endDecorator='✨'
            sx={{
              boxShadow: '0 8px 24px -4px rgb(var(--joy-palette-primary-mainChannel) / 20%)',
              minWidth: 180,
            }}
          >
            Continue
          </Button>
        </Box>

        {/*<Typography level='title-sm' sx={{ mb: 1, placeSelf: 'start', ml: 1 }}>*/}
        {/*  Here is what's new:*/}
        {/*</Typography>*/}

        <Container disableGutters maxWidth='sm'>
          {news?.map((ni, idx) => {
            // const firstCard = idx === 0;
            const hasCardAfter = news.length < NewsItems.length;
            const showExpander = hasCardAfter && (idx === news.length - 1);
            const addPadding = false; //!firstCard; // || showExpander;
            return <React.Fragment key={idx}>

              {/* News Item */}
              <Card key={'news-' + idx} sx={{ mb: 3, minHeight: 32, gap: 1 }}>
                <CardContent sx={{ position: 'relative', pr: addPadding ? 4 : 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography level='title-sm' component='div'>
                      {ni.text ? ni.text : ni.versionName ? <><span style={{ fontWeight: 600 }}>{ni.versionCode}</span> · </> : `Version ${ni.versionCode}:`}
                      <Box
                        component='span'
                        sx={idx ? {} : {
                          animation: `${cssRainbowColorKeyframes} 5s infinite`,
                          fontWeight: 600,
                          zIndex: 1,
                        }}
                      >
                        {ni.versionName}
                      </Box>
                    </Typography>
                    <Typography level='body-sm' sx={{ ml: 'auto' }}>
                      {!!ni.versionDate && <TimeAgo date={ni.versionDate} />}
                    </Typography>
                  </Box>

                  {!!ni.items && (ni.items.length > 0) && (
                    <ul style={{ marginTop: 8, marginBottom: 8, paddingInlineStart: '1.5rem' }}>
                      {ni.items.filter(item => item.dev !== true).map((item, idx) => <li key={idx}>
                        < Typography component='div' level='body-sm'>
                          {item.text}
                        </Typography>
                      </li>)}
                    </ul>
                  )}

                  {showExpander && (
                    <IconButton
                      variant='solid'
                      onClick={() => setLastNewsIdx(idx + 1)}
                      sx={{
                        position: 'absolute', right: 0, bottom: 0, mr: -1, mb: -1,
                        // backgroundColor: 'background.surface',
                        borderRadius: '50%',
                      }}
                    >
                      <ExpandMoreIcon />
                    </IconButton>
                  )}
                </CardContent>

                {!!ni.versionCoverImage && (
                  <CardOverflow sx={{
                    m: '0 calc(var(--CardOverflow-offset) - 1px) calc(var(--CardOverflow-offset) - 1px)',
                  }}>
                    <AspectRatio ratio='2'>
                      <NextImage
                        src={ni.versionCoverImage}
                        alt={`Cover image for ${ni.versionCode}`}
                        // commented: we scale the images to 600px wide (>300 px tall)
                        // sizes='(max-width: 1200px) 100vw, 50vw'
                        priority={idx === 0}
                      />
                    </AspectRatio>
                  </CardOverflow>
                )}
              </Card>

              {/* Inject the roadmap item here*/}
              {idx === 0 && (
                <Box sx={{ mb: 3 }}>
                  {newsRoadmapCallout}
                </Box>
              )}

            </React.Fragment>;
          })}
        </Container>

        {/*<Typography sx={{ textAlign: 'center' }}>*/}
        {/*  Enjoy!*/}
        {/*  <br /><br />*/}
        {/*  -- The {Brand.Title.Base} Team*/}
        {/*</Typography>*/}

      </Box>

    </Box>
  );
}