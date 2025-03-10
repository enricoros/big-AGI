import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, IconButton, Sheet, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { Release } from '~/common/app.release';
import { frontendHashString } from '~/common/util/textUtils';
import { themeZIndexPageBar } from '~/common/app.theme';
import { uiSetDismissed, useUIIsDismissed } from '~/common/stores/store-ui';


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
  const { message, hash, buildTimestamp } = React.useMemo(() => {
    const rawMOTD = process.env.NEXT_PUBLIC_MOTD;
    if (!rawMOTD?.trim()) return { message: null, hash: null, buildTimestamp: null };

    const buildInfo = Release.buildInfo('frontend');
    const message = rawMOTD
      .replace(/{{app_build_hash}}/g, buildInfo.gitSha || '')
      .replace(/{{app_build_pkgver}}/g, buildInfo.pkgVersion || '')
      // .replace(/{{app_build_time}}/g, new Date(buildInfo.timestamp || '').toLocaleDateString()) // we don't do this anymore, as we handle it with TimeAgo.
      .replace(/{{app_deployment_type}}/g, buildInfo.deploymentType || '');

    return {
      message,
      hash: frontendHashString(message),
      buildTimestamp: buildInfo.timestamp || '',
    };
  }, []);


  // external state
  const dismissed = useUIIsDismissed(!hash ? null : MOTD_PREFIX + hash);

  // skip if no MOTD
  if (!message || dismissed === true)
    return null;


  /**
   * Special render function to split '{{app_build_time}}' and insert a TimeAgo component.
   */
  function renderMessageWithTimeAgo(message: string) {
    if (message.includes('{{app_build_time}}')) {
      const parts = message.split('{{app_build_time}}');
      return <>{parts[0]}{buildTimestamp && <TimeAgo date={buildTimestamp} />}{parts[1]}</>;
    }
    return message;
  }

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
        <Box sx={{ p: 1, lineHeight: 'xl' }}>
          {renderMessageWithTimeAgo(message)}
        </Box>
      </Typography>
    </Sheet>
  );
}
