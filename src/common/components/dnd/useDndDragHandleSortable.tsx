import * as React from 'react';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';

import { ColorPaletteProp, IconButton } from '@mui/joy';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

import { dndDragCursorSx } from './dnd.config';


const DRAG_HANDLE_ZINDEX = 1;

const _style = {

  handle: {
    my: -1,
    ml: -1.5,
    // mr: -0.5, // future?
    // mr: 0,
    ...dndDragCursorSx,
    borderRadius: '50%',
    // '&:hover': {
    //   backgroundColor: 'transparent',
    // } as const,
  } as const,

  handleIcon: {
    fontSize: '1.25rem',
    // my: 'auto',
    // '&:active': {}
  } as const,

} as const;


export function useDndDragHandleSortable(id: string, disabled: boolean, color: ColorPaletteProp = 'neutral') {

  // really disable if no id
  if (!id) disabled = true;

  const { setNodeRef, attributes: dragAttributes, listeners: dragListeners, transform: dragTransform, transition: dragTransition, isDragging } =
    useSortable({ id, disabled });

  // memo drag handle
  const dragHandle = React.useMemo(() => disabled ? null : (
    <IconButton
      {...dragAttributes}
      {...dragListeners}
      size='sm'
      variant='plain'
      color={color}
      sx={_style.handle}
    >
      <DragIndicatorIcon sx={_style.handleIcon} />
    </IconButton>
  ), [color, disabled, dragAttributes, dragListeners]);

  // memo container style
  const dragContainerStyle = React.useMemo(() => disabled ? undefined : ({
    transform: CSS.Translate.toString(dragTransform),
    transition: dragTransition,
    // opacity: isDragging ? 0.8 : undefined,
    ...(DRAG_HANDLE_ZINDEX ? { zIndex: isDragging ? DRAG_HANDLE_ZINDEX : undefined } : undefined),
    // the touch-action is set on the drag handle
  }), [disabled, dragTransform, dragTransition, isDragging]);

  return {
    dragContainerSetRef: setNodeRef,
    dragContainerStyle,
    dragHandle,
  };
}
