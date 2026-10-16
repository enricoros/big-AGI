import * as React from 'react';

import { Box, Button } from '@mui/joy';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';

import type { ContentScaling } from '~/common/app.theme';
import { DiffViewer } from '~/common/components/diff/DiffViewer';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { copyToClipboard } from '~/common/util/clipboardUtils';

import type { DiffContextActions, DiffContextData } from './ERCDiffContext';


const _style = {

  modal: {
    // undo GoodModal defaults
    boxShadow: 'none',  // removes the shadow
    maxWidth: undefined, // allows to grow to full width

    // looks
    backgroundColor: 'background.level2',
    // backgroundColor: 'rgba(var(--joy-palette-neutral-lightChannel) / 0.8)',
    // backdropFilter: 'blur(4px)',

    // layout
    minHeight: '18rem', // IMPORTANT: if not defined, the modal will wrap the full height. Beyond this, the <ModalOverflow> scrolls.
    // overflow: 'hidden', // make this take 100% of space, but with scrollable content - NOTE: not needed with minHeight
  } as const,

  diffViewerOuter: {
    borderRadius: 'md',
    border: '1px solid',
    borderColor: 'background.popup',

    backgroundColor: 'background.level1',
    boxShadow: '0px 4px 24px -8px rgb(var(--joy-palette-neutral-darkChannel) / 20%)',
  } as const,

  buttonsGroup: {
    display: 'flex',
    gap: 1,
  } as const,

  button: {
    border: '1px solid',
    borderColor: 'neutral.outlinedBorder',
    backgroundColor: 'background.surface',
  } as const,

} as const;


export function ERCDiffModal(props: {
  title?: React.ReactNode;
  isMobile: boolean;
  contentScaling: ContentScaling;
  diffContext: DiffContextData & DiffContextActions;
}) {

  // check preconditions
  // if (!props.diffContext?.showDiff || !props.diffContext.baseCode || !props.diffContext.compareCode)
  //   return null;

  // derived state
  const { baseCode, baseTitle, compareCode, compareTitle, setBase, setShowDiff } = props.diffContext;

  const handleClose = React.useCallback(() => {
    setShowDiff(false);
    setBase('', '');
  }, [setBase, setShowDiff]);

  const handleCopyBase = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    !!baseCode && copyToClipboard(baseCode, 'Code');
  }, [baseCode]);

  const handleCopyCompare = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    !!compareCode && copyToClipboard(compareCode, 'Code');
  }, [compareCode]);

  return (
    <GoodModal
      open={true}
      onClose={handleClose}
      title={props.title || 'Compare Code'}
      titleStartDecorator={<CompareArrowsIcon />}
      strongerTitle
      // themedColor='neutral'
      unfilterBackdrop
      fullscreen={props.isMobile || 'button'}
      startButton={
        <Box sx={_style.buttonsGroup}>
          <Button size='sm' variant='soft' color='neutral' sx={_style.button} onClick={handleCopyBase}>
            Copy 1
          </Button>
          <Button size='sm' variant='soft' color='neutral' sx={_style.button} onClick={handleCopyCompare}>
            Copy 2
          </Button>
        </Box>
      }
      sx={_style.modal}
    >

      {/* NOTE: may add any sort of <Box /> with a grid layeout and following ContentScaling, etc. */}

      <DiffViewer
        oldTitle={baseTitle || 'Base'}
        oldText={baseCode ?? 'Base Code Not Set'}
        newTitle={compareTitle || 'Current'}
        newText={compareCode ?? 'Current Code Not Set'}
        contentScaling={props.contentScaling}
        initialViewType={props.isMobile ? 'unified' : 'split'}
        renderMode='modal'
        sx={_style.diffViewerOuter}
      />

    </GoodModal>
  );
}
