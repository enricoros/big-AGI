import * as React from 'react';
import { fileSave } from 'browser-fs-access';
import { useShallow } from 'zustand/react/shallow';

import { Box, ListDivider, ListItemDecorator, MenuItem } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveAsIcon from '@mui/icons-material/SaveAs';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { isLiveFileSupported } from '~/common/livefile/store-live-file';
import { reverseLookupMdTitle, reverseLookupMimeType } from '~/common/attachment-drafts/attachment.mimetypes';
import { useLabsDevMode, useUXLabsStore } from '~/common/state/store-ux-labs';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import { getCodeCollapseManager } from './codeCollapseManager';


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
}) {

  // state
  const { showPromisedOverlay } = useOverlayComponents();
  const labsDevMode = useLabsDevMode();
  const { labsEnhanceCodeBlocks, labsEnhanceCodeLiveFile, setLabsEnhanceCodeBlocks, setLabsEnhanceCodeLiveFile } = useUXLabsStore(useShallow(state => ({
    labsEnhanceCodeBlocks: state.labsEnhanceCodeBlocks,
    labsEnhanceCodeLiveFile: state.labsEnhanceCodeLiveFile,
    setLabsEnhanceCodeBlocks: state.setLabsEnhanceCodeBlocks,
    setLabsEnhanceCodeLiveFile: state.setLabsEnhanceCodeLiveFile,
  })));


  // handlers

  const handleCollapseAllCodeBlocks = React.useCallback(() => {
    getCodeCollapseManager().triggerCollapseAll(true);
  }, []);

  const handleExpandAllCodeBlocks = React.useCallback(() => {
    getCodeCollapseManager().triggerCollapseAll(false);
  }, []);

  const { onClose } = props;

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

  const toggleEnhanceCodeBlocks = React.useCallback(() => {
    // turn blocks on (may not even be called, ever)
    if (!labsEnhanceCodeBlocks) {
      setLabsEnhanceCodeBlocks(true);
      return;
    }
    // ask to turn the blocks off
    showPromisedOverlay('blocks-off-enhance-code', {}, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        title='Turn off enhanced code blocks?'
        confirmationText='This will disable LiveFile functionality. You can turn it back on anytime by going to Settings > Labs > Enhance Legacy Code.'
        positiveActionText='Turn Off'
      />,
    ).then(() => setLabsEnhanceCodeBlocks(false)).catch(() => null /* ignore closure */);
  }, [labsEnhanceCodeBlocks, setLabsEnhanceCodeBlocks, showPromisedOverlay]);

  const toggleEnhanceCodeLiveFile = React.useCallback(() => {
    setLabsEnhanceCodeLiveFile(!labsEnhanceCodeLiveFile);
  }, [labsEnhanceCodeLiveFile, setLabsEnhanceCodeLiveFile]);

  const liveFileSupported = isLiveFileSupported();


  return (
    <CloseableMenu
      open={true} dense
      anchorEl={props.anchor} onClose={props.onClose}
      placement='bottom-end'
      sx={{ minWidth: 250 }}
    >

      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <MenuItem onClick={props.onToggleCollapse} sx={{ flex: 2 }}>
          <ListItemDecorator>{props.isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}</ListItemDecorator>
          {props.isCollapsed ? 'Expand' : 'Collapse'}
        </MenuItem>
        <MenuItem onClick={props.isCollapsed ? handleExpandAllCodeBlocks : handleCollapseAllCodeBlocks} sx={{ justifyContent: 'center', flex: 1 }}>
          All
        </MenuItem>
      </Box>

      <ListDivider />

      <MenuItem onClick={handleSaveAs}>
        <ListItemDecorator><SaveAsIcon /></ListItemDecorator>
        Save As ...
      </MenuItem>

      <MenuItem onClick={toggleEnhanceCodeLiveFile} disabled={!liveFileSupported}>
        <ListItemDecorator>{(labsEnhanceCodeLiveFile && liveFileSupported) && <CheckRoundedIcon />}</ListItemDecorator>
        {liveFileSupported ? 'Enable LiveFile' : 'LiveFile - No Browser Support'}
      </MenuItem>

      {labsDevMode && (
        // A mix in between UxLabsSettings (labsEnhanceCodeBlocks) and the ChatDrawer MenuItems
        <MenuItem onClick={toggleEnhanceCodeBlocks}>
          <ListItemDecorator>{labsEnhanceCodeBlocks && <CheckRoundedIcon />}</ListItemDecorator>
          [DEV] Enhanced Blocks
        </MenuItem>
      )}

    </CloseableMenu>
  );
}