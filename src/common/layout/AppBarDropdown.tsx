import * as React from 'react';

import { Box, Divider, ListDivider, ListItemDecorator, Option, Select } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';


export type DropdownItems = Record<string, {
  title: string,
  symbol?: string,
  type?: 'separator'
}>;


/**
 * A Select component that blends-in nicely (cleaner, easier to the eyes)
 */
export function AppBarDropdown<TValue extends string>(props: {
  items: DropdownItems,
  prependOption?: React.JSX.Element,
  appendOption?: React.JSX.Element,
  value: TValue | null,
  onChange: (event: any, value: TValue | null) => void,
  placeholder?: string,
  showSymbols?: boolean,
  sx?: SxProps
}) {
  return <Select
    variant='solid' color='neutral'
    value={props.value} onChange={props.onChange}
    placeholder={props.placeholder}
    indicator={<KeyboardArrowDownIcon />}
    slotProps={{
      root: {
        sx: {
          backgroundColor: 'transparent',
          maxWidth: 'calc(100dvw - 100px)',
        },
      },
      indicator: {
        sx: {
          '--Icon-color': 'rgba(255,255,255, 0.5)',
        },
      },
      listbox: {
        variant: 'outlined', color: 'neutral',
        disablePortal: false,
        sx: {
          '--Icon-fontSize': 'var(--joy-fontSize-xl2)',
          '--ListItem-minHeight': '3rem',
          '--ListItemDecorator-size': (props.showSymbols && !props.appendOption) ? '2.2rem' : '2.75rem',
          maxHeight: 'calc(100dvh - 56px)',
          maxWidth: '90dvw',
        },
      },
    }}
    sx={{
      mx: 0,
      fontWeight: 500,
      ...(props.sx || {}),
    }}
  >
    {props.prependOption}
    {!!props.prependOption && Object.keys(props.items).length >= 1 && <Divider />}

    <Box sx={{ overflowY: 'auto' }}>
      {Object.keys(props.items).map((key: string, idx: number) => <React.Fragment key={'key-' + idx}>
        {props.items[key].type === 'separator'
          ? <ListDivider />
          : <Option variant='plain' value={key} sx={{ whiteSpace: 'nowrap' }}>
            {props.showSymbols && <ListItemDecorator>{props.items[key]?.symbol + ' '}</ListItemDecorator>}
            {props.items[key].title}
            {/*{key === props.value && (*/}
            {/*  <IconButton variant='soft' onClick={() => alert('aa')} sx={{ ml: 'auto' }}>*/}
            {/*    <SettingsIcon color='success' />*/}
            {/*  </IconButton>*/}
            {/*)}*/}
          </Option>
        }
      </React.Fragment>)}
    </Box>

    {!!props.appendOption && Object.keys(props.items).length >= 1 && <ListDivider />}
    {props.appendOption}
  </Select>;
}