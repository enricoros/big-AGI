import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { FormControl, Input } from '@mui/joy';

import { FormLabelStart } from './FormLabelStart';


const formControlSx: SxProps = {
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignItems: 'center',
};


/**
 * Text form field (e.g. enter a host)
 */
export function FormTextField(props: {
  autoCompleteId: string,
  title: string | React.JSX.Element,
  description?: string | React.JSX.Element,
  tooltip?: string | React.JSX.Element,
  placeholder?: string, isError?: boolean, disabled?: boolean,
  value: string | undefined, onChange: (text: string) => void,
}) {
  const acId = 'text-' + props.autoCompleteId;
  return (
    <FormControl
      id={acId}
      orientation='horizontal'
      disabled={props.disabled}
      sx={formControlSx}
    >
      <FormLabelStart title={props.title} description={props.description} tooltip={props.tooltip} />
      <Input
        key={acId}
        name={acId}
        autoComplete='off'
        variant='outlined' placeholder={props.placeholder} error={props.isError}
        value={props.value} onChange={event => props.onChange(event.target.value)}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>
  );
}