import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { FormControl, Option, Select, SelectSlotsAndSlotProps } from '@mui/joy';

import { FormLabelStart } from './FormLabelStart';


// copied from useLLMSelect.tsx - inspired by optimaSelectSlotProps.listbox
const _selectSlotProps: SelectSlotsAndSlotProps<false>['slotProps'] = {
  button: {
    sx: {
      // whiteSpace: 'inherit', // note: we try to keep it in one line for now
      wordBreak: 'break-word',
      minWidth: '6rem',
    } as const,
  } as const,
} as const;


export type FormSelectOption<T extends string> = {
  value: T;
  label: string;
  description: string;
  disabled?: boolean;
};


export const FormSelectControl = <TValue extends string>(props: {
  title?: React.ReactNode;
  tooltip?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  options: Readonly<FormSelectOption<TValue>[]>;
  value?: TValue;
  onChange: (value: TValue) => void;
  placeholder?: React.ReactNode;
  selectSx?: SxProps; // overrides the minimum button width, if 'maxWidth' is set
}) => {
  const selectedOption = props.options.find(option => option.value === props.value);

  return (
    <FormControl size={props.size} orientation='horizontal' disabled={props.disabled} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      {!!props.title && (
        <FormLabelStart
          title={props.title}
          description={selectedOption?.description}
          tooltip={props.tooltip}
        />
      )}
      <Select
        size={props.size}
        value={props.value}
        onChange={(_, value) => value && props.onChange(value as TValue)}
        placeholder={props.placeholder}
        slotProps={!(props.selectSx as any)?.['minWidth'] ? _selectSlotProps : undefined}
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
