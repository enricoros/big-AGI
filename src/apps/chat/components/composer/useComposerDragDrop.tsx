import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Card, Typography } from '@mui/joy';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';


const zIndexComposerOverlayDrop = 20;


const containerSx: SxProps = {
  position: 'relative', /* for Drop overlay */
} as const;

const inactiveCardSx: SxProps = {
  display: 'none',
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: zIndexComposerOverlayDrop,
} as const;

const draggingCardSx: SxProps = {
  ...inactiveCardSx,
  pointerEvents: undefined,
  border: '1px dashed',
  borderRadius: 'sm',
  boxShadow: 'inset 1px 0px 3px -2px var(--joy-palette-success-softColor)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
} as const;


export function useDragDrop(
  disabled: boolean,
  onDataTransfer: (dataTransfer: DataTransfer, type: 'paste' | 'drop', isDropOnTextarea: boolean) => Promise<any>,
) {

  // state
  const [isDragging, setIsDragging] = React.useState(false);


  // handlers

  const eatDragEvent = React.useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);


  const handleExtDragEnter = React.useCallback((event: React.DragEvent) => {
    const isFromSelf = event.dataTransfer.types.includes('x-app/agi');
    if (!isFromSelf) {
      eatDragEvent(event);
      setIsDragging(true);
    }
  }, [eatDragEvent]);

  const handleExtDragStart = React.useCallback((event: React.DragEvent) => {
    event.dataTransfer.setData('x-app/agi', 'do-not-intercept');
  }, []);


  const handleDragLeave = React.useCallback((event: React.DragEvent) => {
    eatDragEvent(event);
    setIsDragging(false);
  }, [eatDragEvent]);

  const handleDragOver = React.useCallback((event: React.DragEvent) => {
    eatDragEvent(event);
    // this makes sure we don't "transfer" (or move) the item, but we tell the sender we'll copy it
    event.dataTransfer.dropEffect = 'copy';
  }, [eatDragEvent]);

  const handleDrop = React.useCallback(async (event: React.DragEvent) => {
    eatDragEvent(event);
    setIsDragging(false);

    const { dataTransfer } = event;

    // VSCode: detect failure of dropping from VSCode, details below:
    //         https://github.com/microsoft/vscode/issues/98629#issuecomment-634475572
    if (dataTransfer.types.includes('codeeditors')) {

      // Get the file paths
      let filePaths: string[] = [];
      if (dataTransfer.types.includes('codefiles')) {
        filePaths = JSON.parse(dataTransfer.getData('codefiles'));
      } else if (dataTransfer.types.includes('text/plain')) {
        filePaths = dataTransfer.getData('text/plain').split('\n').filter(Boolean);
      }
      const fileNames = filePaths.map(path => path.split('\\').pop() || path.split('/').pop() || 'unknown file');

      // just show an old school alert message (save callbacks)
      return alert([
        `Dropped ${fileNames.length} file${fileNames.length > 1 ? 's' : ''} from VSCode:`,
        ...fileNames.map((name, index) => `${index + 1}. ${name}`),
        '',
        'VSCode does not drag-and-drop to browsers. https://github.com/microsoft/vscode/issues/98629#issuecomment-634475572.',
        '',
        'Upload 📎, paste 📋, or drag from a folder 📁.',
      ].join('\n'));
    }

    // textarea drop
    void onDataTransfer(dataTransfer, 'drop', true); // fire/forget
  }, [eatDragEvent, onDataTransfer]);


  const dropComponent = React.useMemo(() => {
    if (disabled) return null;

    return (
      <Card
        color={isDragging ? 'success' : undefined}
        variant={isDragging ? 'soft' : undefined}
        invertedColors={isDragging}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        sx={isDragging ? draggingCardSx : inactiveCardSx}
      >
        {isDragging && <AttachFileRoundedIcon sx={{ width: 36, height: 36, pointerEvents: 'none' }} />}
        {isDragging && <Typography level='title-sm' sx={{ pointerEvents: 'none' }}>
          I will hold on to this for you.
        </Typography>}
      </Card>
    );
  }, [handleDragLeave, handleDragOver, handleDrop, isDragging, disabled]);

  return {
    dragContainerSx: containerSx,
    dragDropComponent: dropComponent,
    handleDragEnter: handleExtDragEnter,
    handleDragStart: handleExtDragStart,
  };
}
