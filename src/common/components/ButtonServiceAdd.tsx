import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Button, IconButton, Tooltip } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';


const _btnSx: SxProps = { borderColor: 'neutral.outlinedBorder' } as const;

export function ButtonServiceAdd(props: {
  isMobile: boolean;
  isEmpty: boolean;
  emptyHint: string;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
  menuOpen?: boolean;
  label?: string;
}) {

  const { isMobile, isEmpty, emptyHint, onClick, menuOpen, label = 'Add' } = props;

  const disabled = !!menuOpen;
  const variant = isEmpty ? 'solid' : 'outlined';

  // Mobile + populated = icon-only (no hint needed - user already knows)
  if (isMobile && !isEmpty)
    return (
      <IconButton color="primary" variant={variant} onClick={onClick} disabled={disabled} sx={_btnSx}>
        <AddIcon />
      </IconButton>
    );

  // Full button with controlled empty-state hint tooltip
  return (
    <Tooltip open={isEmpty && !menuOpen} color='primary' variant='outlined' title={emptyHint} arrow disableInteractive placement={isMobile ? 'bottom-end' : 'top-start'}>
      <Button
        variant={variant}
        disabled={disabled}
        onClick={onClick}
        startDecorator={<AddIcon />}
        sx={_btnSx}
      >
        {label}
      </Button>
    </Tooltip>
  );
}
