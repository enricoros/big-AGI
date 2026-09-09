import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { ListItem, ListItemButton } from '@mui/joy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';


const _styles = {
  headerButton: {
    color: 'text.tertiary',
    py: 1.5,
    border: 'none',
    fontSize: 'sm',
    fontWeight: 'md',
    justifyContent: 'space-between',
    '&[aria-expanded="false"]': {
      fontWeight: 'lg',
      fontStyle: 'italic',
      color: 'text.primary',
    },
  },
  headerDeco: {
    width: '1rem',
  },
  headerCollapser: {
    fontSize: 'md',
    transition: 'transform 0.14s',
    '[aria-expanded="false"] &': {
      transform: 'rotate(-180deg)',
    },
  },
} as const satisfies Record<string, SxProps>;

// read-only header: same layout, inert (no hover, no click, no chevron)
const _headerStaticSx = { ..._styles.headerButton, pointerEvents: 'none' } as const satisfies SxProps;


export function ListItemGroupCollapser<TId extends string>(props: {
  id: TId;
  label: string;
  isCollapsed: boolean;
  onToggleCollapse: (id: TId) => void;
  readOnly?: boolean; // static section label: collapse is display-only bypassed (e.g. while filtering), so no chevron or click
}) {

  if (props.readOnly)
    return (
      <ListItem>
        <ListItemButton color='neutral' tabIndex={-1} sx={_headerStaticSx}>
          <div style={_styles.headerDeco} />
          <div>{props.label}</div>
        </ListItemButton>
      </ListItem>
    );

  return (
    <ListItem>
      <ListItemButton color='neutral' aria-expanded={!props.isCollapsed} onClick={() => props.onToggleCollapse(props.id)} sx={_styles.headerButton}>
        {/*{serviceVendor?.id && <ListItemDecorator><LLMVendorIconSprite vendorId={serviceVendor.id} /></ListItemDecorator>}*/}
        <div style={_styles.headerDeco} />
        <div>{props.label}</div>
        <ExpandMoreIcon sx={_styles.headerCollapser} />
      </ListItemButton>
    </ListItem>
  );
}