import * as React from 'react';

import { FormControl, Radio, RadioGroup } from '@mui/joy';


import { FormLabelStart } from './FormLabelStart';


export type FormRadioOption<T extends string> = {
  value: T,
  label: string | React.JSX.Element,
  disabled?: boolean
};


export const FormRadioControl = <TValue extends string>(props: {
  title: string | React.JSX.Element,
  description?: string | React.JSX.Element,
  tooltip?: string | React.JSX.Element,
  disabled?: boolean;
  options: FormRadioOption<TValue>[];
  value?: TValue;
  onChange: (value: TValue) => void;
}) =>
  <FormControl orientation='horizontal' disabled={props.disabled} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
    {(!!props.title || !!props.description) && <FormLabelStart title={props.title} description={props.description} tooltip={props.tooltip} />}
    <RadioGroup
      orientation='horizontal'
      value={props.value}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => event.target.value && props.onChange(event.target.value as TValue)}
      sx={{ flexWrap: 'wrap' }}
    >
      {props.options.map((option) =>
        <Radio key={'opt-' + option.value} value={option.value} label={option.label} disabled={option.disabled || props.disabled} />,
      )}
    </RadioGroup>
  </FormControl>;