import * as React from 'react';

import { Box, FormControl, FormHelperText, FormLabel, Switch } from '@mui/joy';

import { settingsCol1Width } from '../../app.theme';


/**
 * Switch control
 */
export function FormSwitchControl(props: {
  title: string | React.JSX.Element, description?: string | React.JSX.Element,
  value: boolean, onChange: (on: boolean) => void,
}) {
  return (
    <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
      <Box sx={{ minWidth: settingsCol1Width }}>
        <FormLabel>
          {props.title}
        </FormLabel>
        <FormHelperText sx={{ display: 'block' }}>
          {props.description}
        </FormHelperText>
      </Box>
      <Switch
        checked={props.value}
        onChange={event => props.onChange(event.target.checked)}
        endDecorator={props.value ? 'Enabled' : 'Off'}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>
  );
}