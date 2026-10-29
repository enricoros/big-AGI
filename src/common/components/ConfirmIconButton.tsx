import * as React from 'react';

import { Box, ColorPaletteProp, IconButton, VariantProp } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { TooltipOutlined } from './TooltipOutlined';
import { useArmedConfirm } from './useArmedConfirm';


const _styles = {
  root: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center', // a stretching parent must not grow the button past its my: -1
  },
  button: {
    my: -1,
  },
  // the confirm floats beside the button, so arming never moves the layout or wraps the row
  confirm: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2, // above neighbouring buttons, e.g. the doc chip's
  },
} as const;

const _confirmSideSx = {
  start: { ..._styles.confirm, right: '100%', mr: 0.5 },
  end: { ..._styles.confirm, left: '100%', ml: 0.5 },
} as const;


/**
 * Icon button behind a two-step confirm. Armed, the clicked spot becomes Cancel and the confirm floats
 * (solid danger) on `side` - a double-click slip cancels. Esc cancels too. Icons come as components, sized by the button.
 */
export function ConfirmIconButton(props: {
  icon?: React.ComponentType, // defaults to DeleteOutline
  confirmIcon?: React.ComponentType, // defaults to `icon`, or DeleteForever when `icon` is the default
  color?: ColorPaletteProp, // idle and Cancel, which share the spot
  variant?: VariantProp, // idle and Cancel; unset: plain idle, soft Cancel
  tooltip: string,
  side?: 'start' | 'end', // where the confirm floats; 'start' for buttons at the end of a row
  onConfirm: (event: React.MouseEvent) => void,
}) {

  // state
  const { armed, toggle, confirm, disarm } = useArmedConfirm(props.onConfirm);

  const Icon = props.icon ?? DeleteOutlineIcon;
  const ConfirmIcon = props.confirmIcon ?? props.icon ?? DeleteForeverIcon;

  return (
    <Box
      onKeyDown={event => {
        if (event.key === 'Escape' && armed) {
          event.stopPropagation(); // cancel only, don't close the parent modal
          disarm();
        }
      }}
      sx={_styles.root}
    >
      <TooltipOutlined title={armed ? 'Cancel' : props.tooltip}>
        <IconButton size='sm' variant={props.variant ?? (armed ? 'soft' : 'plain')} color={props.color} aria-label={armed ? 'Cancel' : props.tooltip} onClick={toggle} sx={_styles.button}>
          {armed ? <CloseRoundedIcon /> : <Icon />}
        </IconButton>
      </TooltipOutlined>
      {armed && (
        <TooltipOutlined title={`Confirm: ${props.tooltip}`} color='danger'>
          <IconButton size='sm' variant='solid' color='danger' aria-label={`Confirm: ${props.tooltip}`} onClick={confirm} sx={_confirmSideSx[props.side ?? 'end']}>
            <ConfirmIcon />
          </IconButton>
        </TooltipOutlined>
      )}
    </Box>
  );
}
