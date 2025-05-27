import * as React from 'react';

import { Button, Sheet, Typography } from '@mui/joy';

import { useSingleTabEnforcer } from '../components/useSingleTabEnforcer';


export const ProviderSingleTab = (props: { children: React.ReactNode }) => {

  // state: [isActive, activate]
  const [isActive, activate] = useSingleTabEnforcer('big-agi-tabs');

  // only render the app when this tab owns it
  if (isActive) {
    return <>{props.children}</>;
  }

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
        Click "Use here" to switch to this window.
      </Typography>

      <Button onClick={activate}>
        Use here
      </Button>

    </Sheet>
  );
};