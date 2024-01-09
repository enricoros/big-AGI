import * as React from 'react';

import { FormControl, Input } from '@mui/joy';

import { FormLabelStart } from './FormLabelStart';


/**
 * Text form field (e.g. enter a host)
 */
export function FormTextField(props: {
  title: string | React.JSX.Element,
  description?: string | React.JSX.Element,
  tooltip?: string | React.JSX.Element,
  placeholder?: string, isError?: boolean, disabled?: boolean,
  value: string | undefined, onChange: (text: string) => void,
}) {
  return (
    <FormControl orientation='horizontal' disabled={props.disabled} sx={{ flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title={props.title} description={props.description} tooltip={props.tooltip} />
      <Input
        variant='outlined' placeholder={props.placeholder} error={props.isError}
        value={props.value} onChange={event => props.onChange(event.target.value)}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>
  );
}