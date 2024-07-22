import * as React from 'react';

import { Tooltip, TooltipProps } from '@mui/joy';


export function TooltipOutlined(props: {
  title: React.ReactNode;
  color?: TooltipProps['color'];
  variant?: TooltipProps['variant'];
  placement?: TooltipProps['placement'];
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
    >
      {props.children}
    </Tooltip>
  );
}
