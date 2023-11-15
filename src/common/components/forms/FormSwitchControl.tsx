import * as React from 'react';

import { FormControl, Switch } from '@mui/joy';

import { FormLabelStart } from './FormLabelStart';


/**
 * Switch control
 */
export function FormSwitchControl(props: {
  title: string | React.JSX.Element, description?: string | React.JSX.Element,
  value: boolean, onChange: (on: boolean) => void,
}) {
  return (
    <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title={props.title} description={props.description} />
      <Switch
        checked={props.value}
        onChange={event => props.onChange(event.target.checked)}
        endDecorator={props.value ? 'Enabled' : 'Off'}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>
  );
}