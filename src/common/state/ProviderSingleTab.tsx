import * as React from 'react';

import { Button, Sheet, Typography } from '@mui/joy';

import { Brand } from '../app.config';
import { reloadPage } from '../app.routes';
import { useSingleTabEnforcer } from '../components/useSingleTabEnforcer';


export const ProviderSingleTab = (props: { children: React.ReactNode }) => {

  // state
  const isSingleTab = useSingleTabEnforcer('big-agi-tabs');

  // pass-through until we know for sure that other tabs are open
  if (isSingleTab === null || isSingleTab)
    return props.children;


  return (
    <Sheet
      variant='solid'
      invertedColors
      sx={{
        flexGrow: 1,
        display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'center', alignItems: 'center', gap: 2,
        p: 3,
      }}
    >

      <Typography>
        It looks like {Brand.Title.Base} is already running in another tab or window.
        To continue here, please close the other instance first.
      </Typography>

      <Button onClick={reloadPage}>
        Reload
      </Button>

    </Sheet>
  );
};