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
  asLargePane?: boolean;
  children: React.JSX.Element;
}) {
  return (
    <Tooltip
      title={props.title}
      color={props.color}
      variant={props.variant ?? 'outlined'}
      arrow
      disableInteractive
      placement={props.placement ?? 'top'}
      sx={props.asLargePane ? largePaneSx : undefined}
    >
      {props.children}
    </Tooltip>
  );
}
