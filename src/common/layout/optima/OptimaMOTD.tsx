import * as React from 'react';

import { Box, IconButton, Sheet, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { Release } from '~/common/app.release';
import { frontendHashString } from '~/common/util/textUtils';
import { themeZIndexPageBar } from '~/common/app.theme';
import { uiSetDismissed, useUIIsDismissed } from '~/common/state/store-ui';


// configuration
const MOTD_COLOR = 'primary';
const MOTD_PREFIX = 'motd-';


// toggles the component
export const optimaHasMOTD = !!process.env.NEXT_PUBLIC_MOTD;


/**
 * Message of the day. If set, displays a message on this deployment.
 * The message can be permanently dismissed.
 */
export function OptimaMOTD() {

  // expand special variables in the MOTD
  const { message, hash } = React.useMemo(() => {
    const rawMOTD = process.env.NEXT_PUBLIC_MOTD;
    if (!rawMOTD?.trim()) return { message: null, hash: null };

    const buildInfo = Release.buildInfo('frontend');
    const message = rawMOTD
      .replace(/{{app_build_hash}}/g, buildInfo.gitSha || '')
      .replace(/{{app_build_pkgver}}/g, buildInfo.pkgVersion || '')
      .replace(/{{app_build_time}}/g, new Date(buildInfo.timestamp || '').toLocaleDateString())
      .replace(/{{app_deployment_type}}/g, buildInfo.deploymentType || '');

    return {
      message,
      hash: frontendHashString(message),
    };
  }, []);


  // external state
  const dismissed = useUIIsDismissed(!hash ? null : MOTD_PREFIX + hash);

  // skip if no MOTD
  if (!message || dismissed === true)
    return null;

  return (
    <Sheet
      id='optima-motd'
      component='header'
      variant='solid'
      sx={{ zIndex: themeZIndexPageBar }}
    >
      <Typography
        component='div'
        level='title-sm'
        variant='soft'
        color={MOTD_COLOR}
        endDecorator={
          <IconButton
            size='sm'
            variant='soft'
            color={MOTD_COLOR}
            onClick={() => uiSetDismissed(MOTD_PREFIX + hash)}
            sx={{ ml: 'auto' }}
          >
            <CloseRoundedIcon />
          </IconButton>
        }
        sx={{
          mt: 1,
          mx: 1,
          borderRadius: 'sm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ px: 1 }}>
          {message}
        </Box>
      </Typography>
    </Sheet>
  );
}
