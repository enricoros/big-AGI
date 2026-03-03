import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, FormControl, IconButton, Input, Tooltip } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';

import { FormLabelStart } from './FormLabelStart';


const _style = {
  control: {
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
  },
} as const satisfies Record<string, SxProps>;


/**
 * Compact numeric input field with label and optional description.
 * Supports undefined (unset/default) state with a toggle button:
 * - undefined: input disabled, X button pressed (soft) — input shows empty
 * - number: input active, X button flat (plain) — pressing X clears to undefined
 */
export function FormNumberInput(props: {
  title: string,
  description?: string,
  tooltip?: string,
  disabled?: boolean,
  size?: 'sm' | 'md' | 'lg',
  min?: number,
  max?: number,
  initialValue: number,
  value: undefined | number,
  onChange: (value: number | undefined) => void,
  inputSx?: SxProps,
}) {

  const { onChange, min, max, initialValue } = props;
  const isSet = props.value !== undefined;

  const handleInputChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(event.target.value, 10);
    if (!isNaN(num)) {
      const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, num));
      onChange(clamped);
    }
  }, [max, min, onChange]);

  const handleToggle = React.useCallback(() => {
    if (isSet)
      onChange(undefined);
    else
      onChange(initialValue);
  }, [isSet, onChange, initialValue]);

  return (
    <FormControl size={props.size} disabled={props.disabled} orientation='horizontal' sx={_style.control}>
      <FormLabelStart title={props.title} description={props.description} tooltip={props.tooltip} />
      <Box sx={_style.inputRow}>
        <Input
          type='number'
          size={props.size}
          variant={isSet ? 'outlined' : 'plain'}
          disabled={!isSet}
          placeholder='unset'
          slotProps={{
            input: {
              ...(min !== undefined ? { min } : {}),
              ...(max !== undefined ? { max } : {}),
            },
          }}
          value={isSet ? props.value : ''}
          onChange={handleInputChange}
          sx={props.inputSx}
        />
        <Tooltip arrow disableInteractive title={isSet ? 'Reset to default' : 'Customize'}>
          <IconButton
            size={props.size}
            variant={isSet ? 'plain' : 'soft'}
            onClick={handleToggle}
          >
            <ClearIcon sx={{ fontSize: props.size === 'sm' ? 'md' : 'lg' }} />
          </IconButton>
        </Tooltip>
      </Box>
    </FormControl>
  );
}
