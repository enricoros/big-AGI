import * as React from 'react';

import { Option, Select } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';


export type DropdownItems = Record<string, { title: string, symbol?: string }>;

/**
 * A Select component that blends-in nicely (cleaner, easier to the eyes)
 */
export const AppBarDropdown = <TValue extends string>(props: {
  items: DropdownItems, appendOption?: React.JSX.Element,
  value: TValue | null, onChange: (event: any, value: TValue | null) => void,
  placeholder?: string,
  showSymbols?: boolean,
  sx?: SxProps
}) =>
  <Select
    variant='solid' color='neutral' size='md'
    value={props.value} onChange={props.onChange}
    placeholder={props.placeholder}
    indicator={<KeyboardArrowDownIcon />}
    slotProps={{
      root: {
        sx: {
          backgroundColor: 'transparent',
          '--Icon-color': 'rgba(255,255,255,0.5)',
        },
      },
      listbox: {
        variant: 'plain', color: 'neutral', size: 'lg',
        disablePortal: false,
        sx: {
          maxHeight: 'calc(100dvh - 56px)',
          minWidth: 160,
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
    {props.appendOption}
  </Select>;