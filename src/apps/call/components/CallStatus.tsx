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
  regardingText: string | null,
  micError: boolean, speakError: boolean,
  // llmComponent?: React.JSX.Element,
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>

      {!!props.callerName && <Typography level='h3' sx={{ textAlign: 'center' }}>
        <b>{props.callerName}</b>
      </Typography>}

      {/*{props.llmComponent}*/}

      {!!props.statusText && <Typography level='body-md' sx={{ textAlign: 'center' }}>
        {props.statusText}
      </Typography>}

      {!!props.regardingText && <Typography level='body-md' sx={{ textAlign: 'center', mt: 1 }}>
        Re: <Box component='span' sx={{ color: 'text.primary' }}>{props.regardingText}</Box>
      </Typography>}

      {props.micError && <InlineError
        severity='danger' error='Looks like this Browser may not support speech recognition. You can try Chrome on Windows or Android instead.' />}

      {props.speakError && <InlineError
        severity='danger' error='Text-to-speech does not appear to be configured. Please set it up in Preferences > Voice.' />}

    </Box>
  );
}