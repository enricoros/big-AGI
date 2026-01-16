import * as React from 'react';

import { Box, FormControl, Switch, Tooltip } from '@mui/joy';

import { FormLabelStart } from './FormLabelStart';


/**
 * Reusable toggle for enabling client-side API fetch.
 * Appears with animation when client key is present.
 * Shows a tooltip recommendation when local host is detected but CSF is off.
 */
export function SetupFormClientSideToggle(props: {
  visible: boolean;
  checked: boolean;
  onChange: (on: boolean) => void;
  helpText: string;
  disabled?: boolean;
  localHostDetected?: boolean; // shows a tooltip to hint at using this
}) {

  // show recommendation tooltip for local hosts when CSF is off
  const showLocalRecommendation = !!props.localHostDetected && !props.checked;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: props.visible ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div style={{ overflow: 'hidden' }}>
        <FormControl orientation='horizontal' disabled={props.disabled} sx={{ flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <FormLabelStart
            title='Direct Connection'
            description={props.checked ? 'Connect from browser' : 'Via server (default)'}
            tooltip={showLocalRecommendation ? undefined : props.helpText}
          />
          <Tooltip
            open={showLocalRecommendation}
            disableInteractive
            arrow
            variant='solid'
            color='success'
            placement='top-end'
            title='Recommended ON for local services'
          >
            <Switch
              checked={props.checked}
              onChange={event => props.onChange(event.target.checked)}
              endDecorator={props.checked ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }}
            />
          </Tooltip>
        </FormControl>
      </div>
    </div>
  );
}
