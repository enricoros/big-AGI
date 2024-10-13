import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Tooltip, TooltipProps } from '@mui/joy';


const largePaneSx: SxProps = {
  backgroundColor: 'background.popup',
  boxShadow: 'lg',
};


export function TooltipOutlined(props: {
  title: React.ReactNode;
  color?: TooltipProps['color'];
  variant?: TooltipProps['variant'];
  placement?: TooltipProps['placement'];
  slowEnter?: boolean;
  asLargePane?: boolean;
  enableInteractive?: boolean;
  children: React.JSX.Element;
}) {
  return (
    <Tooltip
      title={props.title}
      color={props.color}
      enterDelay={props.slowEnter ? 600 : 0}
      variant={props.variant ?? 'outlined'}
      arrow
      disableInteractive={!props.enableInteractive}
      placement={props.placement ?? 'top'}
      sx={props.asLargePane ? largePaneSx : undefined}
    >
      {props.children}
    </Tooltip>
  );
}
