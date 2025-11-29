import * as React from 'react';

import { Chip, ChipProps } from '@mui/joy';


/**
 * Simple badge/label component for inline status indicators like "New", "Beta", etc.
 */
export function GoodBadge(props: {
  badge: React.ReactNode;
  color?: ChipProps['color'];
  variant?: ChipProps['variant'];
  sx?: ChipProps['sx'];
}) {
  return (
    <Chip
      size='sm'
      color={props.color ?? 'success'}
      variant={props.variant ?? 'soft'}
      sx={{
        ml: 1.5,
        fontSize: 'xs',
        fontWeight: 'md',
        borderRadius: 'xs',
        px: 1,
        py: 0.25,
        // default "new" color - lime/yellow-green
        ...(props.color === undefined && {
          bgcolor: '#d5ec31',
          color: 'primary.softColor',
        }),
        ...props.sx,
      }}
    >
      {props.badge}
    </Chip>
  );
}