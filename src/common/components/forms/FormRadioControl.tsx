import * as React from 'react';

import { Box, FormControl, Radio, RadioGroup, Tooltip } from '@mui/joy';

import type { Immutable } from '~/common/types/immutable.types';

import { FormLabelStart } from './FormLabelStart';


export type FormRadioOption<T extends string> = {
  value: T,
  label: string | React.JSX.Element,
  description?: string,
  tooltip?: string | React.JSX.Element,
  disabled?: boolean
};

/**
 * Wraps an element in a Tooltip if provided. Uses Joy Tooltip directly (not
 * TooltipOutlined) so the child element remains the direct child of its parent
 * for CSS selector purposes (e.g. ButtonGroup's :first-child/:last-child).
 */
export function optionWithTooltip(tooltip: undefined | string | React.JSX.Element, element: React.JSX.Element): React.JSX.Element {
  if (!tooltip) return element;
  return (
    <Tooltip key={element.key} title={<Box sx={{ p: 1 }}>{tooltip}</Box>} variant='outlined' arrow disableInteractive placement='top'>
      {element}
    </Tooltip>
  );
}


export const FormRadioControl = <TValue extends string>(props: {
  title: string | React.JSX.Element,
  description?: string | React.JSX.Element,
  tooltip?: string | React.JSX.Element,
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  options: Immutable<FormRadioOption<TValue>[]>;
  value?: TValue;
  onChange: (value: TValue) => void;
}) => {
  const selectedOption = props.options.find(option => option.value === props.value);
  const description = selectedOption?.description ?? props.description;

  return (
    <FormControl size={props.size} orientation='horizontal' disabled={props.disabled} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      {(!!props.title || !!description) && <FormLabelStart title={props.title} description={description} tooltip={props.tooltip} />}
      <RadioGroup
        size={props.size}
        orientation='horizontal'
        value={props.value}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => event.target.value && props.onChange(event.target.value as TValue)}
        sx={{ flexWrap: 'wrap', gap: 1 }}
      >
        {props.options.map((option) => optionWithTooltip(option.tooltip,
          <Radio key={'opt-' + option.value} value={option.value} label={option.label} disabled={option.disabled || props.disabled} />,
        ))}
      </RadioGroup>
    </FormControl>
  );
};