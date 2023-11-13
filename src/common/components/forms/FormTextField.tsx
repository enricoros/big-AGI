import * as React from 'react';

import { Box, FormControl, FormHelperText, FormLabel, Input } from '@mui/joy';

import { settingsCol1Width } from '../../app.theme';


/**
 * Text form field (e.g. enter a host)
 */
export function FormTextField(props: {
  title: string | React.JSX.Element, description?: string | React.JSX.Element,
  placeholder?: string, isError?: boolean, disabled?: boolean,
  value: string | undefined, onChange: (text: string) => void,
}) {
  return (
    <FormControl orientation='horizontal' disabled={props.disabled} sx={{ flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
      <Box sx={{ minWidth: settingsCol1Width }}>
        <FormLabel>
          {props.title}
        </FormLabel>
        <FormHelperText sx={{ display: 'block' }}>
          {props.description}
        </FormHelperText>
      </Box>
      <Input
        variant='outlined' placeholder={props.placeholder} error={props.isError}
        value={props.value} onChange={event => props.onChange(event.target.value)}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>
  );
}