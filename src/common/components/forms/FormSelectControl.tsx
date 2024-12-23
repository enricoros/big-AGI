import * as React from 'react';

import { FormControl, Option, Select } from '@mui/joy';

import { FormLabelStart } from './FormLabelStart';
import { SxProps } from '@mui/joy/styles/types';


export type FormSelectOption<T extends string> = {
  value: T;
  label: string;
  description: string;
  disabled?: boolean;
};


export const FormSelectControl = <TValue extends string>(props: {
  title?: React.ReactNode;
  tooltip?: React.ReactNode;
  disabled?: boolean;
  options: Readonly<FormSelectOption<TValue>[]>;
  value?: TValue;
  onChange: (value: TValue) => void;
  placeholder?: React.ReactNode;
  selectSx?: SxProps;
}) => {
  const selectedOption = props.options.find(option => option.value === props.value);

  return (
    <FormControl orientation='horizontal' disabled={props.disabled} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      {!!props.title && (
        <FormLabelStart
          title={props.title}
          description={selectedOption?.description}
          tooltip={props.tooltip}
        />
      )}
      <Select
        value={props.value}
        onChange={(_, value) => value && props.onChange(value as TValue)}
        placeholder={props.placeholder}
        sx={props.selectSx}
      >
        {props.options.map((option, idx) => (
          <Option
            key={option.value || `opt-${idx}`}
            value={option.value}
            disabled={option.disabled || props.disabled}
          >
            {option.label}
          </Option>
        ))}
      </Select>
    </FormControl>
  );
};
