import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { IconButton, IconButtonProps, styled, Tooltip, TooltipProps } from '@mui/joy';


// configuration
export const OVERLAY_BUTTON_RADIUS = '4px';   // note: can't use 'sm', 'md', etc.
export const OVERLAY_BUTTON_ZINDEX = 2;       // top of message and its chips

export const overlayButtonsClassName = 'overlay-buttons';

export const overlayButtonsTopRightSx: SxProps = {
  // stick to the top-right corner
  position: 'absolute',
  top: 0,
  right: 0,
  zIndex: OVERLAY_BUTTON_ZINDEX, // top of message and its chips

  // stype
  p: 0.5,

  // layout
  display: 'flex',
  flexDirection: 'row',
  gap: 1,

  // faded-out defaults
  opacity: 'var(--AGI-overlay-start-opacity, 0)',
  pointerEvents: 'none',

  // 2024-08-24: disabled the fading in/out, it's slow
  // transition: 'opacity 0.1s cubic-bezier(.17,.84,.44,1)',

  // buttongroup: background
  // '& > div > button': {
  //   backgroundColor: 'background.surface',
  //   backdropFilter: 'blur(12px)',
  // },
};

export const overlayButtonsActiveSx = {
  opacity: 1,
  pointerEvents: 'auto',
};


export const StyledOverlayButton = styled(IconButton)(({ theme, variant }) => ({
  backgroundColor: variant === 'outlined' ? theme.palette.background.surface : undefined,
  '--Icon-fontSize': theme.fontSize.lg,
})) as typeof IconButton;

export const overlayButtonShadowSx: SxProps = {
  boxShadow: '0px 1px 3px -2px var(--joy-palette-background-backdrop)',
  // boxShadow:'sm',
};

export const overlayGroupWithShadowSx: SxProps = {
  ...overlayButtonShadowSx,
  '--ButtonGroup-radius': OVERLAY_BUTTON_RADIUS,
};


// New props interface that combines IconButton and Tooltip props
interface OverlayButtonWithTooltipProps extends IconButtonProps {
  tooltip?: React.ReactNode;
  placement?: TooltipProps['placement'];
  tooltipProps?: Partial<Omit<TooltipProps, 'children'>>;
  smShadow?: boolean;
}

export const OverlayButton = ({ tooltip, placement, tooltipProps, smShadow, color, variant, ...buttonProps }: OverlayButtonWithTooltipProps) =>
  tooltip ? (
    <Tooltip disableInteractive arrow placement={placement || 'top'} title={tooltip} color={color} {...tooltipProps}>
      <StyledOverlayButton color={color} variant={variant || 'outlined'} sx={smShadow ? overlayButtonShadowSx : undefined} {...buttonProps} />
    </Tooltip>
  ) : (
    <StyledOverlayButton color={color} variant={variant || 'outlined'} sx={smShadow ? overlayButtonShadowSx : undefined} {...buttonProps} />
  );
