import * as React from 'react';

import { FormControl, FormHelperText, Switch, Typography } from '@mui/joy';

import { toggleAixDebuggerNoStreaming, useAixClientDebuggerStore } from './memstore-aix-client-debugger';


export function DebugAdvancedOptions() {

  // external state
  const aixNoStreaming = useAixClientDebuggerStore(state => state.aixNoStreaming);

  return (
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <Typography level='title-sm'>
          Disable Streaming
        </Typography>
        <FormHelperText sx={{ mt: 0 }}>
          Force all AI requests to not stream
        </FormHelperText>
      </div>
      <Switch
        color={aixNoStreaming ? 'warning' : undefined}
        checked={aixNoStreaming}
        onChange={toggleAixDebuggerNoStreaming}
        endDecorator={aixNoStreaming ? 'On' : 'Off'}
        slotProps={{ endDecorator: { sx: { minWidth: 26 } } }}
      />
    </FormControl>
  );
}
