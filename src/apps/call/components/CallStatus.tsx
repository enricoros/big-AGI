import * as React from 'react';

import { Box, Typography } from '@mui/joy';

import { InlineError } from '~/common/components/InlineError';


/**
 * A status message for the call, such as:
 *
 *             $Name
 *  "Connecting..." or "Call ended",
 *         re: $Regarding
 */
export function CallStatus(props: {
  callerName?: string,
  statusText: string,
  regardingText?: string,
  micError: boolean, speakError: boolean,
  // llmComponent?: React.JSX.Element,
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>

      {!!props.callerName && <Typography level='h3' sx={{ textAlign: 'center' }}>
        <b>{props.callerName}</b>
      </Typography>}

      {/*{props.llmComponent}*/}

      <Typography level='body-md' sx={{ textAlign: 'center' }}>
        {props.statusText}
      </Typography>

      {!!props.regardingText && <Typography level='body-md' sx={{ textAlign: 'center', mt: 0 }}>
        re: {props.regardingText}
      </Typography>}

      {props.micError && <InlineError
        severity='danger' error='But this browser does not support speech recognition... 🤦‍♀️ - Try Chrome on Windows?' />}

      {props.speakError && <InlineError
        severity='danger' error='And text-to-speech is not configured... 🤦‍♀️ - Configure it in Settings?' />}

    </Box>
  );
}