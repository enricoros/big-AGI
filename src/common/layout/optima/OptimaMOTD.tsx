import * as React from 'react';

import { Box, IconButton, Sheet, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { Release } from '~/common/app.release';
import { themeZIndexPageBar } from '~/common/app.theme';


// configuration
const MOTD_COLOR = 'primary';


// toggles the component
export const optimaHasMOTD = !!process.env.NEXT_PUBLIC_MOTD;


/**
 * Message of the day. If set, displays a message on this deployment.
 * The message can be closed temporarily, but will display again at the next refresh.
 */
export function OptimaMOTD() {

  // state
  const [dismissed, setDismissed] = React.useState(false);


  // expand special variables in the MOTD
  const processedMotd = React.useMemo(() => {
    const rawMOTD = process.env.NEXT_PUBLIC_MOTD;
    if (!rawMOTD?.trim()) return null;

    const buildInfo = Release.buildInfo('frontend');
    return rawMOTD
      .replace(/{{app_build_hash}}/g, buildInfo.gitSha || '')
      .replace(/{{app_build_pkgver}}/g, buildInfo.pkgVersion || '')
      .replace(/{{app_build_time}}/g, new Date(buildInfo.timestamp || '').toLocaleDateString())
      .replace(/{{app_deployment_type}}/g, buildInfo.deploymentType || '');
  }, []);


  // skip if no MOTD
  if (!processedMotd || dismissed)
    return null;

  return (
    <Sheet
      id='optima-motd'
      component='header'
      variant='solid'
      sx={{ zIndex: themeZIndexPageBar }}
    >
      <Typography
        level='title-sm'
        variant='soft'
        color={MOTD_COLOR}
        endDecorator={
          <IconButton
            size='sm'
            variant='soft'
            color={MOTD_COLOR}
            onClick={() => setDismissed(true)}
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
          {processedMotd}
        </Box>
      </Typography>
    </Sheet>
  );
}
