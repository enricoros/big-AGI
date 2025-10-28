import * as React from 'react';
import NextImage from 'next/image';
import TimeAgo from 'react-timeago';

import { AspectRatio, Box, Button, Card, CardContent, CardOverflow, ColorPaletteProp, Container, Divider, Grid, ListDivider, Sheet, Typography, VariantProp } from '@mui/joy';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LaunchIcon from '@mui/icons-material/Launch';

import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { Brand } from '~/common/app.config';
import { Link } from '~/common/components/Link';
import { ROUTE_INDEX } from '~/common/app.routes';
import { Release } from '~/common/app.release';
import { animationColorBlues, animationColorRainbow } from '~/common/util/animUtils';
import { useIsMobile } from '~/common/components/useMatchMedia';

import { BigAgiProNewsCallout, bigAgiProUrl } from './bigAgiPro.data';
import { DevNewsItem, newsFrontendTimestamp, NewsItems } from './news.data';
import { beamNewsCallout } from './beam.data';


// number of news items to show by default, before the expander
const NEWS_INITIAL_COUNT = 3;
const NEWS_LOAD_STEP = 2;


export const newsRoadmapCallout =
  <Card variant='solid' invertedColors>
    <CardContent sx={{ gap: 2 }}>
      <Typography level='title-lg'>
        Open Roadmap
      </Typography>
      <Typography level='body-sm'>
        Take a peek at our roadmap to see what&apos;s in the pipeline.
        Discover upcoming features and let us know what excites you the most!
      </Typography>
      <Grid container spacing={1}>
        <Grid xs={12} sm={7}>
          <Button
            fullWidth variant='soft' color='primary' endDecorator={<LaunchIcon />}
            component={Link} href={Brand.URIs.OpenProject} noLinkStyle target='_blank'
          >
            Explore
          </Button>
        </Grid>
        <Grid xs={12} sm={5} sx={{ display: 'flex', flexAlign: 'center', justifyContent: 'center' }}>
          <Button
            fullWidth variant='plain' color='primary' endDecorator={<LaunchIcon />}
            component={Link} href={Brand.URIs.OpenRepo + '/issues/new?template=roadmap-request.md&title=%5BSuggestion%5D'} noLinkStyle target='_blank'
          >
            Suggest a Feature
          </Button>
        </Grid>
      </Grid>
    </CardContent>
  </Card>;

export function BuildInfoCard(props: { noMargin?: boolean }) {
  return (
    <Card variant='solid' color='neutral' invertedColors sx={props.noMargin ? undefined : { mb: 3 }}>
      <Typography level='title-md' sx={{ my: -1 }}>
        Development Build Information
      </Typography>
      <BuildInfoSheet />
    </Card>
  );
}

function BuildInfoSheet() {
  const backendBuild = React.useMemo(() => getBackendCapabilities().build, []);
  const frontendBuild = React.useMemo(() => Release.buildInfo('frontend'), []);
  return (
    <Sheet variant='soft' invertedColors sx={{
      fontSize: 'xs',
      // fontFamily: 'code',
      color: 'text.secondary',
      backgroundColor: 'background.popup',
      // border: '1px solid',
      // borderColor: 'divider',
      borderRadius: 'sm',
      // boxShadow: 'inset 1px 1px 4px -2px rgba(0,0,0,0.1)',
      p: 1,
      mb: -1,
      mx: -1,
    }}>
      PL: <strong>{Release.TenantSlug}</strong> · package {backendBuild?.pkgVersion} ({Release.Monotonics.NewsVersion}).<br />
      Frontend: {frontendBuild.gitSha} - deployed {frontendBuild.timestamp ? <strong><TimeAgo date={frontendBuild.timestamp} /></strong> : 'unknown'}, and
      backend {backendBuild?.gitSha}{backendBuild?.timestamp === frontendBuild.timestamp ? '.' : backendBuild?.timestamp ? <TimeAgo date={backendBuild?.timestamp!} /> : 'unknown.'}<br />
      Ships with -modal/-model: {Object.entries(Release.TechLevels).map(([name, version], idx, arr) => <React.Fragment key={name}><strong>{name}</strong> v{version}{idx < arr.length - 1 ? ', ' : ''}</React.Fragment>)}.<br />
      Ships with intelligent functions: {Release.AiFunctions.map((name, idx, arr) => <React.Fragment key={name}><i>{name}</i>{idx < arr.length - 1 ? ', ' : ''}</React.Fragment>)}.
    </Sheet>
  );
}


function NewsCard(props: {
  newsItem: typeof NewsItems[number];
  idx: number;
  addPadding: boolean;
  color?: ColorPaletteProp,
  variant?: Exclude<VariantProp, 'outlined'>,
}) {

  const { addPadding, idx, newsItem: ni } = props;

  return (
    <Card color={props.color} variant={props.variant ?? 'plain'} sx={{
      mb: 3, minHeight: 32, gap: 1,
      boxShadow: !idx ? 'md' : undefined,
    }}>
      <CardContent sx={{ position: 'relative', pr: addPadding ? 4 : 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography level='title-sm' component='div'>
            {ni.text ? ni.text : ni.versionName ? <><b>{ni.versionCode}</b> · </> : `Version ${ni.versionCode}:`}
            <Box
              component='span'
              sx={idx ? {} : {
                animation: `${animationColorRainbow} 5s infinite`,
                fontWeight: 'lg',
                zIndex: 1, /* perf-opt */
              }}
            >
              {ni.versionName}
            </Box>
          </Typography>
          <Typography level='body-sm' sx={{ ml: 'auto' }}>
            {idx === 0 && !ni.versionDate && newsFrontendTimestamp
              ? <TimeAgo date={newsFrontendTimestamp} />
              : !!ni.versionDate && <TimeAgo date={ni.versionDate} />}
          </Typography>
        </Box>

        {!!ni.items && (ni.items.length > 0) && (
          <ul style={{ marginTop: 8, marginBottom: 8, paddingInlineStart: '1.5rem', listStyleType: '"-  "' }}>
            {ni.items.filter(item => item.dev !== true).map((item, idx) => (
              <li key={idx} style={{ listStyle: (item.icon || item.noBullet) ? '" "' : '"-  "', marginLeft: item.icon ? '-1.125rem' : undefined }}>
                <Typography component='div' sx={{ fontSize: 'sm' }}>
                  {item.icon && <item.icon sx={{ fontSize: 'xs', mr: 0.75 }} />}
                  {item.text}
                </Typography>
              </li>
            ))}
          </ul>
        )}

        {/*{idx === 0 && <BuildInfoSheet />}*/}

      </CardContent>

      {!!ni.versionCoverImage && (
        <CardOverflow sx={{
          m: '0 var(--CardOverflow-offset) var(--CardOverflow-offset)',
        }}>
          <AspectRatio ratio='2'>
            <NextImage
              src={ni.versionCoverImage}
              alt={`Cover image for ${ni.versionCode}`}
              // commented: we scale the images to 600px wide (>300 px tall)
              // sizes='(max-width: 1200px) 100vw, 50vw'
              priority={idx === 0}
              quality={90}
            />
          </AspectRatio>
        </CardOverflow>
      )}

    </Card>
  )
}


export function AppNews() {
  // state
  const [lastNewsIdx, setLastNewsIdx] = React.useState<number>(NEWS_INITIAL_COUNT - 1);

  // external state
  const isMobile = useIsMobile();

  // news selection
  const news = NewsItems.filter((_, idx) => idx <= lastNewsIdx);
  const firstNews = news[0] ?? null;

  // show expander
  const canExpand = news.length < NewsItems.length;

  return (

    <Box sx={{
      flexGrow: 1,
      overflowY: 'auto',
      display: 'flex', justifyContent: 'center',
      p: { xs: 3, md: 6 },
      // backgroundColor: 'background.level2'
    }}>

      <Box sx={{
        my: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>

        <Typography level='h1' sx={{ fontSize: '2.7rem', mb: 4 }}>
          Welcome to <Box component='span' sx={{ animation: `${animationColorBlues} 10s infinite`, zIndex: 1 /* perf-opt */ }}>Big-AGI Open</Box>!
        </Typography>

        <Typography sx={{ mb: 2, textAlign: 'center', lineHeight: 'lg' }} level='title-sm'>
          Big-AGI has been updated to version {firstNews?.versionCode}<br/>
          {/*You are running version {firstNews?.versionCode}<br/>*/}
          {/*{!!newsFrontendTimestamp && <span style={{ opacity: 0.5 }}>Updated <TimeAgo date={newsFrontendTimestamp} /></span>}*/}
        </Typography>

        <Box sx={{ mb: 5, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant='solid' color='neutral' size='lg'
            component={Link} href={ROUTE_INDEX} noLinkStyle
            endDecorator={<ArrowForwardRoundedIcon />}
            sx={{
              // boxShadow: '0 8px 24px -4px rgb(var(--joy-palette-primary-mainChannel) / 20%)',
              minWidth: 180,
            }}
          >
            Continue
          </Button>
          {!Release.IsNodeDevBuild && (
            <Button
              variant='solid' color='primary' size='lg'
              component={Link} href={bigAgiProUrl} target='_blank' noLinkStyle
              endDecorator={<><ArrowOutwardRoundedIcon /></>}
              sx={{
                boxShadow: '0 8px 24px -4px rgb(var(--joy-palette-primary-mainChannel) / 20%)',
                minWidth: 180,
                // transform: 'translateY(-1px)',
              }}
            >
              Big-AGI Pro
              ✨
            </Button>
          )}
        </Box>

        {/*<Typography level='title-sm' sx={{ mb: 1, placeSelf: 'start', ml: 1 }}>*/}
        {/*  Here is what's new:*/}
        {/*</Typography>*/}

        <Container disableGutters maxWidth='sm'>

          {/* Inject the callout item here*/}
          {/*<Box sx={{ mb: 3 }}>*/}
          {/*  <BigAgiProNewsCallout />*/}
          {/*</Box>*/}

          {/* Development Notices */}
          {Release.TenantSlug === 'open' && Release.IsNodeDevBuild && <NewsCard variant='soft' color='warning' newsItem={DevNewsItem} idx={0} addPadding={false} />}

          {news?.map((ni, idx) => {
            // const firstCard = idx === 0;
            const addPadding = false; //!firstCard; // || showExpander;
            return <React.Fragment key={idx}>

              {/* Inject the callout item here*/}
              {/*{idx === 0 && (*/}
              {/*  <Box sx={{ mb: 3 }}>*/}
              {/*    <BigAgiProNewsCallout />*/}
              {/*  </Box>*/}
              {/*)}*/}

              {/* Inject the Beam item here*/}
              {idx === 2 && (
                <Box sx={{ mb: 3 }}>
                  {beamNewsCallout}
                </Box>
              )}

              {/* News Item */}
              <NewsCard key={'news-' + idx} newsItem={ni} idx={idx} addPadding={addPadding} />

              {/* Inject the roadmap item here*/}
              {idx === 3 && (
                <Box sx={{ mb: 3 }}>
                  {newsRoadmapCallout}
                </Box>
              )}

              {idx === 0 && <Divider sx={{ my: 6, mx: 6 }}/>}

            </React.Fragment>;
          })}

          {/* Inject the Build Info Sheet */}
          {!isMobile && <BuildInfoCard />}

          {canExpand && (
            <Button
              fullWidth
              variant='soft'
              color='neutral'
              onClick={() => setLastNewsIdx(index => index + NEWS_LOAD_STEP)}
              endDecorator={<ExpandMoreIcon />}
            >
              Previous News
            </Button>
          )}

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