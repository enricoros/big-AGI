import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Card, Typography } from '@mui/joy';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';


// constants
const zIndexComposerOverlayDrop = 20;
const EXCLUDE_SELF_TYPE = 'x-app/agi';


// styles

const dragContainerSx: SxProps = {
  position: 'relative', /* for Drop overlay */
} as const;

const dropCardInactiveSx: SxProps = {
  display: 'none',
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: zIndexComposerOverlayDrop,
} as const;

const dropCardDraggingCardSx: SxProps = {
  ...dropCardInactiveSx,
  pointerEvents: undefined,
  border: '1px dashed',
  borderRadius: 'sm',
  boxShadow: 'inset 1px 0px 3px -2px var(--joy-palette-success-softColor)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
} as const;


// Drag/Drop that can be used in any component and invokes a DataTransfer callback on success

export function useDragDropDataTransfer(enabled: boolean, dropText: string, onDropCallback: (dataTransfer: DataTransfer) => Promise<any>) {

  // state
  const [isDragging, setIsDragging] = React.useState(false);


  const _eatDragEvent = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);


  // Container events

  const handleContainerDragEnter = React.useCallback((event: React.DragEvent) => {
    const isFromSelf = event.dataTransfer.types.includes(EXCLUDE_SELF_TYPE);
    if (!isFromSelf) {
      _eatDragEvent(event);
      setIsDragging(true);
    }
  }, [_eatDragEvent]);

  const handleContainerDragStart = React.useCallback((event: React.DragEvent) => {
    event.dataTransfer.setData(EXCLUDE_SELF_TYPE, 'do-not-intercept');
  }, []);


  // Drop Target events

  const _handleDragOver = React.useCallback((event: React.DragEvent) => {
    _eatDragEvent(event);
    // this makes sure we don't "transfer" (or move) the item, but we tell the sender we'll copy it
    event.dataTransfer.dropEffect = 'copy';
  }, [_eatDragEvent]);

  const _handleDragLeave = React.useCallback((event: React.DragEvent) => {
    _eatDragEvent(event);
    setIsDragging(false);
  }, [_eatDragEvent]);

  const _handleDrop = React.useCallback(async (event: React.DragEvent) => {
    _eatDragEvent(event);
    setIsDragging(false);
    await onDropCallback(event.dataTransfer);
  }, [_eatDragEvent, onDropCallback]);


  const dropComponent = React.useMemo(() => {
    if (!enabled) return null;

    return (
      <Card
        color={isDragging ? 'success' : undefined}
        variant={isDragging ? 'soft' : undefined}
        invertedColors={isDragging}
        onDragLeave={_handleDragLeave}
        onDragOver={_handleDragOver}
        onDrop={_handleDrop}
        sx={isDragging ? dropCardDraggingCardSx : dropCardInactiveSx}
      >
        {isDragging && <AttachFileRoundedIcon sx={{ width: 36, height: 36, pointerEvents: 'none' }} />}
        {isDragging && <Typography level='title-sm' sx={{ pointerEvents: 'none' }}>
          {dropText}
        </Typography>}
      </Card>
    );
  }, [enabled, isDragging, _handleDragLeave, _handleDragOver, _handleDrop, dropText]);


  return {
    dragContainerSx,
    dropComponent,
    handleContainerDragEnter,
    handleContainerDragStart,
    isDragging,
  };
}
