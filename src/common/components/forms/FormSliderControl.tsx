import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { FormControl, Slider, VariantProp } from '@mui/joy';

import { FormLabelStart } from './FormLabelStart';


const _styleNoTrack = {
  '--Slider-trackBackground': 'transparent'
} as const satisfies SxProps;

/**
 * Slider Control
 */
export function FormSliderControl(props: {
  title: string | React.JSX.Element, description?: string | React.JSX.Element, ariaLabel?: string,
  size?: 'sm' | 'md' | 'lg',
  variant?: VariantProp,
  disabled?: boolean,
  min?: number, max?: number, step?: number, defaultValue?: number,
  valueLabelDisplay?: 'on' | 'auto' | 'off',
  value: number | number[] | null, onChange: (value: number) => void,
  startAdornment?: React.ReactNode,
  endAdornment?: React.ReactNode,
  styleNoTrack?: boolean,
  sliderSx?: SxProps,
}) {


  // state
  const [displayValue, setDisplayValue] = React.useState<number | number[] | null>(props.value);

  // [effect] sync with the outside world
  React.useEffect(() => {
    setDisplayValue(props.value);
  }, [props.value]);


  // enable interim + signal-upon-commit behavior

  const { onChange } = props;

  const handleChangeCommitted = React.useCallback((_event: unknown, value: number | number[]) => {
    setDisplayValue(value);
    // NOTE: we also support ranges, such in the Gemini Thinking Token settings, but in any case we force types as numbers as that's the common case
    onChange?.(value as number);
  }, [onChange]);

  const handleChange = React.useCallback((_event: unknown, value: number | number[]) => {
    setDisplayValue(value);
  }, []);


  return (
    <FormControl size={props.size} disabled={props.disabled} orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title={props.title} description={props.description} />
      {props.startAdornment}
      <Slider
        aria-label={props.ariaLabel}
        color='neutral'
        variant={props.variant}
        size={props.size}
        disabled={props.disabled}
        min={props.min} max={props.max} step={props.step} defaultValue={props.defaultValue}
        value={displayValue === null ? undefined : displayValue}
        onChange={handleChange}
        onChangeCommitted={handleChangeCommitted}
        valueLabelDisplay={props.valueLabelDisplay}
        sx={props.styleNoTrack ? _styleNoTrack : props.sliderSx}
      />
      {props.endAdornment}
    </FormControl>
  );
}