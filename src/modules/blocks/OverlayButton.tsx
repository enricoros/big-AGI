import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { IconButton, IconButtonProps, styled, Tooltip, TooltipProps } from '@mui/joy';


export const overlayButtonsClassName = 'overlay-buttons';

export const overlayButtonsSx: SxProps = {
  // stick to the top-right corner
  position: 'absolute',
  top: 0,
  right: 0,
  zIndex: 2, // top of message and its chips

  // stype
  p: 0.5,

  // layout
  display: 'flex',
  flexDirection: 'row',
  gap: 1,

  // faded-out defaults
  opacity: 'var(--AGI-overlay-start-opacity, 0)',
  pointerEvents: 'none',
  transition: 'opacity 0.2s cubic-bezier(.17,.84,.44,1)',
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


// New props interface that combines IconButton and Tooltip props
interface OverlayButtonWithTooltipProps extends IconButtonProps {
  tooltip?: React.ReactNode;
  placement?: TooltipProps['placement'];
  tooltipProps?: Partial<Omit<TooltipProps, 'children'>>;
}

export const OverlayButton = ({ tooltip, placement, tooltipProps, color, variant, ...buttonProps }: OverlayButtonWithTooltipProps) =>
  tooltip ? (
    <Tooltip disableInteractive placement={placement || 'top'} title={tooltip} color={color} {...tooltipProps}>
      <StyledOverlayButton color={color} variant={variant || 'outlined'} {...buttonProps} />
    </Tooltip>
  ) : (
    <StyledOverlayButton color={color} variant={variant || 'outlined'} {...buttonProps} />
  );
