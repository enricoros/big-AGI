import * as React from 'react';

import { Box, Button, Card, CardContent, Container, IconButton, Typography } from '@mui/joy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { Brand } from '~/common/brand';
import { Link } from '~/common/components/Link';
import { capitalizeFirstLetter } from '~/common/util/textUtils';

import { NewsItems } from './news.data';


export function AppNews() {
  // state
  const [lastNewsIdx, setLastNewsIdx] = React.useState<number>(0);

  // news selection
  const news = NewsItems.filter((_, idx) => idx <= lastNewsIdx);
  const firstNews = news[0] ?? null;

  return (

    <Box sx={{
      backgroundColor: 'background.level1',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flexGrow: 1,
      overflowY: 'auto',
      minHeight: 96,
      p: { xs: 3, md: 6 },
      gap: 4,
    }}>

      <Typography level='h1' sx={{fontSize: '3.6rem'}}>
        New updates!
      </Typography>

      <Typography>
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
              {!!item.text && <Typography component='div'>
                {item.text}
              </Typography>}

              {!!item.items && (item.items.length > 0) && <ul style={{ marginTop: 8, marginBottom: 8, paddingInlineStart: 32 }}>
                {item.items.map((item, idx) => <li key={idx}>
                  <Typography component='div'>
                    {item.text}
                  </Typography>
                </li>)}
              </ul>}

              {!firstCard && (
                <Typography level='body-sm' sx={{ position: 'absolute', right: 0, top: 0 }}>
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

      {/*<Typography sx={{ textAlign: 'center' }}>*/}
      {/*  Enjoy!*/}
      {/*  <br /><br />*/}
      {/*  -- The {Brand.Title.Base} Team*/}
      {/*</Typography>*/}

    </Box>
  );
}