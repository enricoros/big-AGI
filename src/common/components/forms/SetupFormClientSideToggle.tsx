import * as React from 'react';

import { Box, FormControl, Switch, Tooltip } from '@mui/joy';

import { FormLabelStart } from './FormLabelStart';


/**
 * Reusable toggle for enabling client-side API fetch.
 * Appears with animation when client key is present.
 * Shows a tooltip recommendation when local host is detected but CSF is off.
 *
 * With `notAllowedBy`, for a vendor that blocks browser requests: the same row, off and disabled, saying who does not
 * allow it. Shown rather than hidden, so that the missing option explains itself.
 */
export function SetupFormClientSideToggle(props: {
  visible: boolean;
} & ({
  checked: boolean;
  onChange: (on: boolean) => void;
  helpText: string;
  disabled?: boolean;
  localHostDetected?: boolean; // shows a tooltip to hint at using this
} | {
  notAllowedBy: string; // the vendor's name
})) {

  const notAllowedBy = 'notAllowedBy' in props ? props.notAllowedBy : undefined;
  const offered = 'notAllowedBy' in props ? undefined : props;
  const checked = !!offered?.checked;

  // show recommendation tooltip for local hosts when CSF is off
  const showLocalRecommendation = !!offered?.localHostDetected && !checked;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: props.visible ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div style={{ overflow: 'hidden' }}>
        <FormControl orientation='horizontal' disabled={offered ? offered.disabled : true} sx={{ flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <FormLabelStart
            title='Direct Connection'
            description={notAllowedBy ? `${notAllowedBy} does not allow it` : checked ? 'Connect from browser' : 'Via server (default)'}
            tooltip={showLocalRecommendation ? undefined : offered?.helpText}
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
              checked={checked}
              variant={notAllowedBy ? 'outlined' : undefined}
              onChange={event => offered?.onChange(event.target.checked)}
              endDecorator={checked ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }}
            />
          </Tooltip>
        </FormControl>
      </div>
    </div>
  );
}
