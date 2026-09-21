import * as React from 'react';
// import { useShallow } from 'zustand/react/shallow';

import { FormControl, FormHelperText, Switch, Typography } from '@mui/joy';

// import { useUXLabsStore } from '~/common/stores/store-ux-labs';

import { toggleAixDebuggerNoStreaming, useAixClientDebuggerStore } from './memstore-aix-client-debugger';


export function DebugAdvancedOptions() {

  // external state
  const aixNoStreaming = useAixClientDebuggerStore(state => state.aixNoStreaming);
  // const [labsUnlockRefresh, setLabsUnlockRefresh] = useUXLabsStore(useShallow(state => [state.labsUnlockRefresh, state.setLabsUnlockRefresh]));

  return <>

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

    {/* Unlock Refresh: the pipeline is live (getLabsHighPerformance), the switch is off - to enable, uncomment this, the state and the 2 imports above */}
    {/*<FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>*/}
    {/*  <div>*/}
    {/*    <Typography level='title-sm'>*/}
    {/*      Unlock Refresh*/}
    {/*    </Typography>*/}
    {/*    <FormHelperText sx={{ mt: 0 }}>*/}
    {/*      Draw every token in Chats and Beams - high CPU use, may stutter*/}
    {/*    </FormHelperText>*/}
    {/*  </div>*/}
    {/*  <Switch*/}
    {/*    color={labsUnlockRefresh ? 'warning' : undefined}*/}
    {/*    checked={labsUnlockRefresh}*/}
    {/*    onChange={event => setLabsUnlockRefresh(event.target.checked)}*/}
    {/*    endDecorator={labsUnlockRefresh ? 'On' : 'Off'}*/}
    {/*    slotProps={{ endDecorator: { sx: { minWidth: 26 } } }}*/}
    {/*  />*/}
    {/*</FormControl>*/}

  </>;
}
