import type { SxProps } from '@mui/joy/styles/types';

import type { Modifiers } from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';

export const dndModifiers: Modifiers = [restrictToParentElement] as const;
export const dndModifiersParentVertical: Modifiers = [restrictToVerticalAxis, restrictToParentElement] as const;

export const dndDragCursorSx: SxProps = {
  touchAction: 'none', // DnD prevent scrolling on mobile
  cursor: 'grab',
  '&:active': { cursor: 'grabbing' },
} as const;