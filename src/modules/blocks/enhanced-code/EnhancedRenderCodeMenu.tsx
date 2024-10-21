import * as React from 'react';
import { fileSave } from 'browser-fs-access';
import { useShallow } from 'zustand/react/shallow';

import { Box, ListDivider, ListItemDecorator, MenuItem } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import SaveAsOutlinedIcon from '@mui/icons-material/SaveAsOutlined';

import { CloseablePopup } from '~/common/components/CloseablePopup';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { isLiveFileSupported } from '~/common/livefile/store-live-file';
import { reverseLookupMdTitle, reverseLookupMimeType } from '~/common/attachment-drafts/attachment.mimetypes';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

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
  // const { showPromisedOverlay } = useOverlayComponents();
  // const labsDevMode = useLabsDevMode();
  const { labsEnhanceCodeLiveFile, setLabsEnhanceCodeLiveFile } = useUXLabsStore(useShallow(state => ({
    // labsEnhanceCodeBlocks: state.labsEnhanceCodeBlocks,
    // setLabsEnhanceCodeBlocks: state.setLabsEnhanceCodeBlocks,
    labsEnhanceCodeLiveFile: state.labsEnhanceCodeLiveFile,
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

  const handleCopyToClipboard = React.useCallback(() => {
    copyToClipboard(props.code, 'Code');
  }, [props.code]);

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

  const toggleEnhanceCodeLiveFile = React.useCallback(() => {
    setLabsEnhanceCodeLiveFile(!labsEnhanceCodeLiveFile);
  }, [labsEnhanceCodeLiveFile, setLabsEnhanceCodeLiveFile]);

  const liveFileSupported = isLiveFileSupported();


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

      <MenuItem onClick={handleSaveAs}>
        <ListItemDecorator><SaveAsOutlinedIcon /></ListItemDecorator>
        Save As ...
      </MenuItem>

      <ListDivider />

      <MenuItem onClick={toggleEnhanceCodeLiveFile} disabled={!liveFileSupported}>
        <ListItemDecorator>{(labsEnhanceCodeLiveFile && liveFileSupported) && <CheckRoundedIcon />}</ListItemDecorator>
        {liveFileSupported ? 'LiveFile Patch' : 'LiveFile - No Browser Support'}
      </MenuItem>

      {/*{labsDevMode && (*/}
      {/*  // A mix in between UxLabsSettings (labsEnhanceCodeBlocks) and the ChatDrawer MenuItems*/}
      {/*  <MenuItem onClick={toggleEnhanceCodeBlocks}>*/}
      {/*    <ListItemDecorator>{labsEnhanceCodeBlocks && <CheckRoundedIcon />}</ListItemDecorator>*/}
      {/*    [DEV] Enhanced Code Blocks*/}
      {/*  </MenuItem>*/}
      {/*)}*/}

    </CloseablePopup>
  );
}