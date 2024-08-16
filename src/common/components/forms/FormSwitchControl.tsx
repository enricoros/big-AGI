import * as React from 'react';

import { FormControl, Switch } from '@mui/joy';

import { FormLabelStart } from './FormLabelStart';


/**
 * Switch control
 */
export function FormSwitchControl(props: {
  title: string | React.JSX.Element, description?: string | React.JSX.Element,
  on?: string, off?: string, fullWidth?: boolean,
  checked: boolean, onChange: (on: boolean) => void,
  disabled?: boolean,
  tooltip?: React.ReactNode,
}) {
  return (
    <FormControl orientation='horizontal' disabled={props.disabled} sx={{ flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title={props.title} description={props.description} tooltip={props.tooltip} />
      <Switch
        checked={props.checked}
        onChange={event => props.onChange(event.target.checked)}
        endDecorator={props.checked ? props.on || 'On' : props.off || 'Off'}
        sx={props.fullWidth ? { flexGrow: 1 } : undefined}
        slotProps={{ endDecorator: { sx: { minWidth: 26 } } }}
      />
    </FormControl>
  );
}