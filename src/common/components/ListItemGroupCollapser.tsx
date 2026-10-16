import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { IconButton, ListItem, ListItemButton } from '@mui/joy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';


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
    '&:hover .agi-collapse-all': {
      opacity: 1,
    },
  },
  headerDeco: {
    width: '1rem',
  },
  headerCollapseAll: {
    '--IconButton-size': '1.5rem',
    m: -0.5,
    opacity: 0,
    transition: 'opacity 0.14s',
  },
  headerCollapser: {
    fontSize: 'md',
    transition: 'transform 0.14s',
    '[aria-expanded="false"] &': {
      transform: 'rotate(-180deg)',
    },
  },
} as const satisfies Record<string, SxProps>;

// read-only header: same layout, inert (no hover, no click, chevron hidden but still laid out)
const _headerStaticSx = { ..._styles.headerButton, pointerEvents: 'none' } as const satisfies SxProps;
const _headerCollapserHiddenSx = { ..._styles.headerCollapser, visibility: 'hidden' } as const satisfies SxProps;


export function ListItemGroupCollapser<TId extends string>(props: {
  id: TId;
  label: string;
  isCollapsed: boolean;
  onToggleCollapse: (id: TId) => void;
  onCollapseAll?: () => void;
  readOnly?: boolean; // static section label: collapse is display-only bypassed (e.g. while filtering), so no chevron, caret or click
}) {

  const { onCollapseAll, readOnly } = props;
  const handleCollapseAll = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onCollapseAll?.();
  }, [onCollapseAll]);

  return (
    <ListItem>
      <ListItemButton
        color='neutral'
        aria-expanded={readOnly ? undefined : !props.isCollapsed}
        tabIndex={readOnly ? -1 : undefined}
        onClick={readOnly ? undefined : () => props.onToggleCollapse(props.id)}
        sx={readOnly ? _headerStaticSx : _styles.headerButton}
      >
        {/*{serviceVendor?.id && <ListItemDecorator><LLMVendorIconSprite vendorId={serviceVendor.id} /></ListItemDecorator>}*/}
        {(onCollapseAll && !readOnly) ? (
          <IconButton
            className='agi-collapse-all'
            size='sm'
            variant='soft'
            aria-label='Collapse all sections'
            onClick={handleCollapseAll}
            sx={_styles.headerCollapseAll}
          >
            <KeyboardArrowLeftIcon />
          </IconButton>
        ) : (
          <div style={_styles.headerDeco} />
        )}
        <div>{props.label}</div>
        <ExpandMoreIcon sx={readOnly ? _headerCollapserHiddenSx : _styles.headerCollapser} />
      </ListItemButton>
    </ListItem>
  );
}