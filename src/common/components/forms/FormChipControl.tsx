import * as React from 'react';

import { Box, Chip, FormControl } from '@mui/joy';

import type { FormRadioOption } from './FormRadioControl';
import { FormLabelStart } from './FormLabelStart';


const _styles = {

  control: {
    justifyContent: 'space-between',
    alignItems: 'center',
  } as const,

  chipGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 1,
  } as const,

  chip: {
    '--Chip-minHeight': '1.75rem', // this makes it prob better
    px: 1.5,
  } as const,

} as const;


/**
 * Exact drop-in replacement for FormRadioControl, but with Chips.
 */
export const FormChipControl = <TValue extends string>(props: {
  // specific
  size?: 'sm' | 'md' | 'lg',
  // =FormRadioControl
  title: string | React.JSX.Element;
  description?: string | React.JSX.Element;
  tooltip?: string | React.JSX.Element;
  disabled?: boolean;
  options: FormRadioOption<TValue>[];
  value?: TValue;
  onChange: (value: TValue) => void;
}) => {

  const { onChange } = props;

  const handleChipClick = React.useCallback((value: TValue) => {
    if (!props.disabled)
      onChange(value);
  }, [onChange, props.disabled]);

  return (
    <FormControl orientation='horizontal' disabled={props.disabled} sx={_styles.control}>
      {(!!props.title || !!props.description) && <FormLabelStart title={props.title} description={props.description} tooltip={props.tooltip} />}
      <Box sx={_styles.chipGroup}>
        {props.options.map((option) => (
          <Chip
            key={'opt-' + option.value}
            size={props.size}
            disabled={option.disabled || props.disabled}
            variant={props.value === option.value ? 'solid' : 'outlined'}
            // color={props.value === option.value ? 'neutral' : 'neutral'}
            onClick={() => handleChipClick(option.value)}
            sx={_styles.chip}
          >
            {option.label}
          </Chip>
        ))}
      </Box>
    </FormControl>
  );
};
