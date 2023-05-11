import * as React from 'react';

import { Option, Select } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';


type DropdownItem = Record<string, { title: string, symbol?: string }>;

/**
 * A Select component that blends-in nicely (cleaner, easier to the eyes)
 */
export const AppBarDropdown = <TValue extends string>(props: { value: TValue, items: DropdownItem, showSymbols?: boolean, onChange: (event: any, value: TValue | null) => void, sx?: SxProps }) =>
  <Select
    variant='solid' color='neutral' size='md'
    value={props.value} onChange={props.onChange}
    indicator={<KeyboardArrowDownIcon />}
    slotProps={{
      root: {
        sx: {
          backgroundColor: 'transparent',
        },
      },
      listbox: {
        variant: 'plain', color: 'neutral', size: 'lg',
        disablePortal: false,
        sx: {
          minWidth: 160,
        },
      },
      indicator: {
        sx: {
          opacity: 0.5,
        },
      },
    }}
    sx={{
      mx: 0,
      /*fontFamily: theme.vars.fontFamily.code,*/
      fontWeight: 500,
      ...(props.sx || {}),
    }}
  >
    {Object.keys(props.items).map((key: string, idx: number) => (
      // ISSUE: Since Joy alpha.76+, the text will not be visually refreshed
      // Opened this BUG report to JoyUI: https://github.com/mui/material-ui/issues/37235
      // When the bug closes, we can go back to the latest JoyUI version in package.json
      <Option key={idx} value={key}>
        {props.showSymbols ? props.items[key]?.symbol || '' : ''} {props.items[key].title}
      </Option>
    ))}
  </Select>;