import * as React from 'react';
import { fileSave } from 'browser-fs-access';

import { Box, ListDivider, ListItemDecorator, MenuItem } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DisabledByDefaultIcon from '@mui/icons-material/DisabledByDefault';
import SaveAsOutlinedIcon from '@mui/icons-material/SaveAsOutlined';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';

import { CloseablePopup } from '~/common/components/CloseablePopup';
import { animationSpinHalfPause } from '~/common/util/animUtils';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { reverseLookupMdTitle, reverseLookupMimeType } from '~/common/attachment-drafts/attachment.mimetypes';

import { getCodeCollapseManager } from './codeCollapseManager';
import { useERCDiffContext } from './ERCDiffContext';


/**
 * Small hidden context menu to toggle the code enhancer, globally.
 */
export function EnhancedRenderCodeMenu(props: {
  anchor: HTMLElement,
  title: string,
  code: string,
  onClose: () => void,
  isCollapsed: boolean,
  onToggleCollapse: () => void,
  onDeleteContainingCodeBlock?: (code: string) => void,
}) {

  // state
  const deleteActionRef = React.useRef<HTMLDivElement>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{
    code: string;
    title: string;
    onDelete: (code: string) => void;
  } | null>(null);
  // Confirmation belongs to this code and deletion target; changes require a new confirmation.
  const deleteArmed = !!deleteTarget && deleteTarget.code === props.code && deleteTarget.title === props.title
    && deleteTarget.onDelete === props.onDeleteContainingCodeBlock;
  // const { showPromisedOverlay } = useOverlayComponents();

  // external state
  const diffContext = useERCDiffContext();


  // handlers

  const handleCollapseAllCodeBlocks = React.useCallback(() => {
    getCodeCollapseManager().triggerCollapseAll(true);
  }, []);

  const handleExpandAllCodeBlocks = React.useCallback(() => {
    getCodeCollapseManager().triggerCollapseAll(false);
  }, []);

  const { onClose, onDeleteContainingCodeBlock } = props;

  const handleCopyToClipboard = React.useCallback(() => {
    copyToClipboard(props.code, 'Code');
  }, [props.code]);

  const canCompare = !!diffContext?.baseCode && diffContext.baseCode !== props.code;

  const handleSetAsDiffBase = React.useCallback(() => {
    if (!diffContext) return;
    diffContext.setBase(props.code, props.title || '(no title)');
    diffContext.setShowDiff(false); // just to be sure
    onClose();
  }, [diffContext, onClose, props.code, props.title]);

  const handleClearDiffBase = React.useCallback(() => {
    if (!diffContext) return;
    diffContext.setBase('', '');
    diffContext.setShowDiff(false);
    onClose();
  }, [diffContext, onClose]);

  const handleCompareWithBase = React.useCallback(() => {
    if (!diffContext) return;
    diffContext.setCompare(props.code, props.title || '(no title)');
    diffContext.setShowDiff(true);
    onClose();
  }, [diffContext, onClose, props.code, props.title]);

  const handleSaveAs = React.useCallback(async () => {
    // guess the mimetype from the markdown title
    let mimeType = 'text/plain';
    let extension = '';
    const hasExtension = props.title.includes('.');
    if (hasExtension) {
      extension = props.title.split('.').pop()!;
      mimeType = reverseLookupMimeType(extension) || 'text/plain';
    } else {
      const data = reverseLookupMdTitle(props.title);
      if (data?.extension)
        extension = data.extension;
      if (data?.mimeType)
        mimeType = data.mimeType;
    }

    // content to be saved
    const blob = new Blob([props.code], { type: mimeType });

    // save content
    await fileSave(blob, {
      fileName: props.title || undefined,
      extensions: extension ? [`.${extension}`] : undefined,
      mimeTypes: mimeType ? [mimeType] : undefined,
    }).then(() => onClose())
      .catch(() => null);
  }, [onClose, props.code, props.title]);

  // const toggleEnhanceCodeBlocks = React.useCallback(() => {
  //   // turn blocks on (may not even be called, ever)
  //   if (!labsEnhanceCodeBlocks) {
  //     setLabsEnhanceCodeBlocks(true);
  //     return;
  //   }
  //   // ask to turn the blocks off
  //   showPromisedOverlay('blocks-off-enhance-code', {}, ({ onResolve, onUserReject }) =>
  //     <ConfirmationModal
  //       open onClose={onUserReject} onPositive={() => onResolve(true)}
  //       title='Turn off enhanced code blocks?'
  //       confirmationText='This will disable LiveFile functionality. You can turn it back on anytime by going to Settings > Labs > Enhance Legacy Code.'
  //       positiveActionText='Turn Off'
  //     />,
  //   ).then(() => setLabsEnhanceCodeBlocks(false)).catch(() => null /* ignore closure */);
  // }, [labsEnhanceCodeBlocks, setLabsEnhanceCodeBlocks, showPromisedOverlay]);

  // delete this code block
  const handleCancelDelete = React.useCallback(() => {
    setDeleteTarget(null);
    deleteActionRef.current?.focus();
  }, []);

  const handleDelete = React.useCallback(() => {
    if (!onDeleteContainingCodeBlock) return;
    if (deleteArmed) {
      onDeleteContainingCodeBlock(props.code);
      onClose();
      return;
    }
    setDeleteTarget({ code: props.code, title: props.title, onDelete: onDeleteContainingCodeBlock });
  }, [deleteArmed, onClose, onDeleteContainingCodeBlock, props.code, props.title]);



  return (
    <CloseablePopup
      menu anchorEl={props.anchor} onClose={props.onClose}
      dense
      minWidth={250}
      placement='bottom-end'
    >

      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <MenuItem onClick={props.onToggleCollapse} sx={{ flex: 0.6 }}>
          <ListItemDecorator>{props.isCollapsed ? <UnfoldMoreIcon /> : <UnfoldLessIcon />}</ListItemDecorator>
          {props.isCollapsed ? 'Expand' : 'Collapse'}
        </MenuItem>
        <MenuItem onClick={props.isCollapsed ? handleExpandAllCodeBlocks : handleCollapseAllCodeBlocks} sx={{ justifyContent: 'center', flex: 0.4 }}>
          <ListItemDecorator>{props.isCollapsed ? <UnfoldMoreIcon /> : <UnfoldLessIcon />}</ListItemDecorator>
          All
        </MenuItem>
      </Box>

      <ListDivider />

      <MenuItem onClick={handleCopyToClipboard}>
        <ListItemDecorator><ContentCopyIcon /></ListItemDecorator>
        Copy
      </MenuItem>

      {/* Delete (with confirmation) */}
      {!!onDeleteContainingCodeBlock && (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {deleteArmed && (
            <MenuItem onClick={handleCancelDelete} sx={{ flex: 1 }}>
              <ListItemDecorator><CloseRoundedIcon /></ListItemDecorator>
              Cancel
            </MenuItem>
          )}
          {/* Ask / Confirm */}
          <MenuItem ref={deleteActionRef} onClick={handleDelete} sx={{ flex: 1 }}>
            <ListItemDecorator>{deleteArmed ? <DeleteForeverIcon sx={{ color: 'danger.solidBg' }} /> : <DeleteOutlineIcon />}</ListItemDecorator>
            {deleteArmed ? 'Confirm delete' : 'Delete'}
          </MenuItem>
        </Box>
      )}

      <MenuItem onClick={handleSaveAs}>
        <ListItemDecorator><SaveAsOutlinedIcon /></ListItemDecorator>
        Save As ...
      </MenuItem>

      {/* Diff Menu entries */}
      {!!diffContext && <>
        <ListDivider />

        {/*{!!diffContext.baseCode && (*/}
        {/*  <ListItem>*/}
        {/*    <Typography level='body-sm'>Comparing</Typography>*/}
        {/*  </ListItem>*/}
        {/*)}*/}

        {!diffContext.baseCode && (
          <MenuItem onClick={handleSetAsDiffBase}>
            <ListItemDecorator><CompareArrowsIcon /></ListItemDecorator>
            <div>Compare <span style={{ opacity: 0.5 }}>From ...</span></div>
          </MenuItem>
        )}

        {!!diffContext.baseCode && (
          <MenuItem onClick={handleCompareWithBase} disabled={!canCompare} color={!canCompare ? undefined : 'success'}>
            <ListItemDecorator><CompareArrowsIcon sx={!canCompare ? undefined : { animation: `${animationSpinHalfPause} 2s ease-out` }} /></ListItemDecorator>
            <Box fontWeight='lg'>Compare <span style={{ opacity: 0.5 }}>To ...</span></Box>
          </MenuItem>
        )}

        {!!diffContext.baseCode && (
          <MenuItem onClick={handleClearDiffBase}>
            <ListItemDecorator><DisabledByDefaultIcon /></ListItemDecorator>
            Cancel <span style={{ opacity: 0.5 }}>Comparison</span>
          </MenuItem>
        )}
      </>}

    </CloseablePopup>
  );
}
