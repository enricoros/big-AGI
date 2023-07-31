import * as React from 'react';

import { Divider, ListDivider, Option, Select } from '@mui/joy';
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
export const AppBarDropdown = <TValue extends string>(props: {
  items: DropdownItems,
  prependOption?: React.JSX.Element,
  appendOption?: React.JSX.Element,
  value: TValue | null,
  onChange: (event: any, value: TValue | null) => void,
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
          // minWidth: 200,
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
    {props.prependOption}
    {!!props.prependOption && Object.keys(props.items).length >= 1 && <Divider />}

    {Object.keys(props.items).map((key: string, idx: number) => <React.Fragment key={'key-' + idx}>
      {props.items[key].type === 'separator'
        ? <ListDivider sx={{ my: 0 }} />
        : <Option variant='plain' value={key} sx={{ whiteSpace: 'nowrap' }}>
          {props.showSymbols ? props.items[key]?.symbol || ' ' : ' '} {props.items[key].title}
          {/*{key === props.value && (*/}
          {/*  <IconButton variant='soft' onClick={() => alert('aa')} sx={{ ml: 'auto' }}>*/}
          {/*    <SettingsIcon color='info' />*/}
          {/*  </IconButton>*/}
          {/*)}*/}
        </Option>
      }
    </React.Fragment>)}

    {!!props.appendOption && Object.keys(props.items).length >= 1 && <ListDivider sx={{ my: 0 }} />}
    {props.appendOption}
  </Select>;