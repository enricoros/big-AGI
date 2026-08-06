import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Button, ButtonGroup, ColorPaletteProp, FormControl } from '@mui/joy';

import type { Immutable } from '~/common/types/immutable.types';

import { FormLabelStart } from './FormLabelStart';
import { FormRadioOption, optionWithTooltip } from './FormRadioControl';


// configuration

const _styles = {

  control: {
    flexGrow: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  } as const,

  group: {
    // group looks
    // backgroundColor: 'background.popup',
    '--ButtonGroup-separatorColor': 'none !important', // disable because != 1px
    '--ButtonGroup-separatorSize': 0, // disable because != 1px
    '--ButtonGroup-radius': '1rem',
    // border: '1px solid',
    // borderColor: 'neutral.outlinedBorder',
    // boxShadow: '0px 4px 24px -8px rgb(var(--joy-palette-neutral-darkChannel) / 50%)',

    // button looks
    // alignItems: 'center', // this makes sure they don't stretch vertically to the full size
    // '& > button': {
    //   '--Icon-fontSize': 'var(--joy-fontSize-lg, 1.125rem)',
    //   minHeight: '2.5rem',
    //   minWidth: '2.75rem',
    // },
  },

  btnSm: {
    '--Button-minHeight': '1.5rem',
    px: 1.5,
    py: 0,
    fontSize: 'xs',
    fontWeight: 'lg',
  },

  btn: {
    '--Button-minHeight': '1.75rem',
    px: 1.625,
    py: 0,
    fontWeight: 'lg',
  },

} as const satisfies Record<string, SxProps>;


/**
 * Exact drop-in replacement for FormRadioControl, but with a ButtonGroup.
 */
export const FormChipGroupControl = <TValue extends string>(props: {
  // specific
  size?: 'sm' | 'md' | 'lg',
  color?: ColorPaletteProp,
  renderVariant?: 'soft' | 'solid',
  // =FormRadioControl
  title: string | React.JSX.Element;
  description?: string | React.JSX.Element;
  tooltip?: string | React.JSX.Element;
  disabled?: boolean;
  options: Immutable<FormRadioOption<TValue>[]>;
  value?: TValue;
  onChange: (value: Immutable<TValue>) => void;
}) => {

  // derived
  const rvSolid = props.renderVariant === 'solid';
  const active = props.options.find(option => option.value === props.value);
  const desc = active?.description ?? props.description;

  return (
    <FormControl size={props.size} orientation='horizontal' disabled={props.disabled} sx={_styles.control}>

      {(!!props.title || !!desc) && <FormLabelStart title={props.title} description={desc} tooltip={props.tooltip} />}

      <ButtonGroup
        size={props.size}
        color={props.color}
        variant={rvSolid ? 'outlined' : 'soft'} // we customize per-button - use 'soft' or 'outlined + bcolor + per-item'
        sx={_styles.group}
      >
        {props.options.map((option) => optionWithTooltip(option.tooltip,
          <Button
            aria-pressed={option === active}
            key={option.value}
            variant={!rvSolid ? undefined : option === active ? 'solid' : 'outlined'}
            disabled={option.disabled || props.disabled}
            onClick={() => {
              !props.disabled && props.onChange(option.value);
            }}
            sx={props.size === 'sm' ? _styles.btnSm : _styles.btn}
          >
            {option.label}
          </Button>,
        ))}
      </ButtonGroup>

    </FormControl>
  );
};
