import * as React from 'react';

import { Button, Sheet, Typography } from '@mui/joy';

import { reloadPage } from '../app.routes';
import { useSingleTabEnforcer } from '../components/useSingleTabEnforcer';


export const ProviderSingleTab = (props: { disabled?: boolean, children: React.ReactNode }) => {

  // state
  const isSingleTab = useSingleTabEnforcer('big-agi-tabs');

  // pass-through until we know for sure that other tabs are open
  if (props.disabled || isSingleTab === null || isSingleTab)
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
        It looks like this app is already running in another browser Tab or Window.<br />
        To continue here, please close the other instance first.
      </Typography>

      <Button onClick={reloadPage}>
        Reload
      </Button>

    </Sheet>
  );
};