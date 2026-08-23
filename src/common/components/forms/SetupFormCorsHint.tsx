import * as React from 'react';

import { Alert, Typography } from '@mui/joy';


/**
 * Shown after a failed Direct Connection fetch on a LOCAL vendor (LM Studio, LocalAI, Ollama, ...).
 *
 * The browser reports every failed cross-origin fetch as an opaque `TypeError: Failed to fetch` - it names
 * neither CORS nor a dead server, deliberately, since telling those apart would turn fetch() into a port
 * scanner. For a local server the user just pointed us at, a missing CORS opt-in is by far the most common
 * cause and the only one they can act on blind, so we lead with it and leave the raw error below.
 *
 * Text is per-vendor (`children`): each enables CORS differently - a UI toggle, a container env var, a daemon
 * env var - and naming the wrong knob is worse than naming none.
 */
export function SetupFormCorsHint(props: { visible: boolean, children: React.ReactNode }) {
  if (!props.visible)
    return null;
  return (
    <Alert variant='soft' color='primary'>
      <Typography level='body-sm' color='primary' variant='soft'>
        {props.children}
      </Typography>
    </Alert>
  );
}
