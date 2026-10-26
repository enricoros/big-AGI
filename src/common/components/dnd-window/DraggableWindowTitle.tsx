import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, ColorPaletteProp, IconButton, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';


interface DraggableWindowTitleProps {
  color: ColorPaletteProp;
  title: string;
  active: boolean;
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void; // to initiate drags on desktop
  onTouchStart?: (e: React.TouchEvent) => void; // to initiate drags on mobile
  children?: React.ReactNode;
  sxStable?: SxProps;
}

export function DraggableWindowTitle(props: DraggableWindowTitleProps) {
  const { active, color, title, onClose, onMouseDown, onTouchStart, sxStable, children } = props;

  const stylesMemo = React.useMemo(() => ({
    header: {
      gap: 1,
      p: 0.5,
      pl: 1,
      borderBottom: '1px solid',
      borderColor: `${color}.outlinedBorder`,
      cursor: 'move',
      userSelect: 'none',
      touchAction: 'none', // prevent browser handling of touch gestures (scroll/pan)
      display: 'flex',
      alignItems: 'center',
      // dynamic coloring
      transition: 'background-color 0.14s ease',
      '&:hover': { backgroundColor: `${color}.softHoverBg` },
      '&[aria-pressed="true"]': { backgroundColor: `${color}.softActiveBg` },
      ...sxStable,
    },
    dragIndicator: {
      fontSize: 'xl',
      color: `${color}.softColor`,
    },
    title: {
      color: `${color}.softColor`,
      flexGrow: 1,
      fontFamily: 'code',
      fontSize: 'sm',
    },
  } as const), [color, sxStable]);

  return (
    <Box onMouseDown={onMouseDown} onTouchStart={onTouchStart} sx={stylesMemo.header} aria-pressed={active}>
      <DragIndicatorIcon sx={stylesMemo.dragIndicator} />

      <Typography color={color} sx={stylesMemo.title}>
        {title}
      </Typography>

      {children}

      {/* Close button */}
      {/*<GoodTooltip title='Close'>*/}
      <IconButton
        aria-label={`Close ${title.toLowerCase()}`}
        size='sm'
        variant='plain'
        color={color}
        onClick={onClose}
      >
        <CloseRoundedIcon />
      </IconButton>
      {/*</GoodTooltip>*/}
    </Box>
  );
}