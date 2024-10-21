import * as React from 'react';

import { Box, Button, IconButton, ListDivider, ListItem, ListItemDecorator, MenuItem, SvgIcon, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import CodeIcon from '@mui/icons-material/Code';

import type { LiveFileId, LiveFileMetadata } from '~/common/livefile/liveFile.types';
import { CloseablePopup } from '~/common/components/CloseablePopup';
import { LiveFileChooseIcon, LiveFileIcon } from '~/common/livefile/liveFile.icons';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { getFirstFileSystemFileHandle } from '~/common/util/fileSystemUtils';
import { useDragDropDataTransfer } from '~/common/components/useDragDropDataTransfer';

import type { DWorkspaceId } from './workspace.types';
import { useContextWorkspaceId } from './WorkspaceIdProvider';
import { useWorkspaceContentsMetadata } from './useWorkspaceContentsMetadata';


// configuration
const ENABLE_AUTO_WORKSPACE_PICK = false;


/**
 * Allows selection of LiveFiles in the current Workspace
 */
export function WorkspaceLiveFilePicker(props: {
  allowRemove?: boolean;
  autoSelectName: string | null;
  labelButton: string;
  labelTooltip?: string;
  liveFileId: LiveFileId | null;
  onSelectLiveFile: (id: LiveFileId | null) => Promise<void>;
  onSelectFileOpen: (workspaceId: DWorkspaceId | null) => Promise<void>;
  onSelectFileSystemFileHandle?: (workspaceId: DWorkspaceId | null, fsHandle: FileSystemFileHandle) => Promise<void>;
}) {

  // state for anchor
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);

  // external state
  const workspaceId = useContextWorkspaceId();
  const { liveFilesMetadata: wLiveFiles } = useWorkspaceContentsMetadata(workspaceId);

  // set as disabled when empty
  const haveLiveFiles = wLiveFiles.length > 0;
  const { autoSelectName, liveFileId, onSelectLiveFile, onSelectFileOpen, onSelectFileSystemFileHandle } = props;


  // [effect] auto-select a LiveFileId
  React.useEffect(() => {
    if (!ENABLE_AUTO_WORKSPACE_PICK || !haveLiveFiles || !wLiveFiles.length)
      return;

    if (wLiveFiles.length === 1) {
      // auto-select the only LiveFile
      void onSelectLiveFile(wLiveFiles[0].id);
    } else {
      // auto-select by name
      const lfm = wLiveFiles.find(lfm => lfm.name === autoSelectName);
      if (lfm)
        void onSelectLiveFile(lfm.id);
    }
  }, [haveLiveFiles, wLiveFiles, autoSelectName, onSelectLiveFile]);


  // handlers

  const handleToggleMenu = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)
    setMenuAnchor(anchor => anchor ? null : event.currentTarget);
  }, []);

  const handleCloseMenu = React.useCallback(() => {
    setMenuAnchor(null);
  }, []);

  const handleSelectLiveFile = React.useCallback((id: LiveFileId | null) => {
    setMenuAnchor(null);
    void onSelectLiveFile(id);
  }, [onSelectLiveFile]);

  const handleSelectNewFile = React.useCallback(async () => {
    if (onSelectFileOpen) {
      setMenuAnchor(null);
      await onSelectFileOpen(workspaceId);
    }
  }, [onSelectFileOpen, workspaceId]);

  const handleDataTransferDrop = React.useCallback(async (dataTransfer: DataTransfer) => {
    if (onSelectFileSystemFileHandle) {
      const fsfHandle = await getFirstFileSystemFileHandle(dataTransfer);
      if (fsfHandle) {
        setMenuAnchor(null);
        await onSelectFileSystemFileHandle(workspaceId, fsfHandle);
      }
    }
  }, [onSelectFileSystemFileHandle, workspaceId]);

  const { dragContainerSx, dropComponent, handleContainerDragEnter, handleContainerDragStart } =
    useDragDropDataTransfer(true, 'Select', LiveFileChooseIcon as typeof SvgIcon, 'startDecorator', true, handleDataTransferDrop);

  // styles
  const containerSx = React.useMemo(() => ({
    ...dragContainerSx,
    display: 'flex',
    alignItems: 'center',
  }), [dragContainerSx]);


  const showRemove = !!liveFileId && props.allowRemove === true;

  return <>

    {/* Main Button, also a drop target */}
    <Box
      onDragEnter={handleContainerDragEnter}
      onDragStart={handleContainerDragStart}
      sx={containerSx}
    >
      {!liveFileId ? (
        <TooltipOutlined title={props.labelTooltip} placement='top-end'>
          <Button
            variant='plain'
            color='neutral'
            size='sm'
            onClick={handleToggleMenu}
            startDecorator={<LiveFileChooseIcon />}
            // endDecorator={<LiveFilePatchIcon color='success' />}
          >
            {props.labelButton}
          </Button>
        </TooltipOutlined>
      ) : (
        <IconButton
          size='sm'
          onClick={handleToggleMenu}
        >
          <LiveFileIcon />
          {/*<LiveFilePatchIcon color='success' />*/}
        </IconButton>
      )}

      {dropComponent}
    </Box>


    {/* Select/Upload file menu */}
    {!!menuAnchor && (
      <CloseablePopup
        menu anchorEl={menuAnchor} onClose={handleCloseMenu}
        placement='bottom-end'
        sx={{ '--ListItem-paddingRight': '1.5rem' }}
      >

        {/* Workspace Files (if any) */}
        <ListItem>
          <Typography level='body-sm'>Select Target:</Typography>
        </ListItem>

        {haveLiveFiles && wLiveFiles.map((lfm: LiveFileMetadata) => (
          <MenuItem
            key={lfm.id}
            selected={lfm.id === liveFileId}
            onClick={() => handleSelectLiveFile(lfm.id)}
            sx={{ border: 'none' }}
          >
            <ListItemDecorator><CodeIcon /></ListItemDecorator>
            {/*<Box>*/}
            {lfm.name}
            {/*<Box component='span' sx={{ fontSize: 'xs', display: 'block', color: 'text.tertiary' }}>*/}
            {/*  {lfm.size?.toLocaleString() || '(unknown)'} bytes {lfm.type ? `· ${lfm.type}` : ''}*/}
            {/*</Box>*/}
            {/*</Box>*/}
          </MenuItem>
        ))}

        {/* Pair a new file */}
        {haveLiveFiles && <ListDivider sx={{ my: 0 }} />}
        <MenuItem
          onClick={handleSelectNewFile}
          // sx={haveLiveFiles ? { minHeight: '3rem' } : undefined}
        >
          <ListItemDecorator>
            <LiveFileChooseIcon />
          </ListItemDecorator>
          Open File...
        </MenuItem>

        {/* Remove pairing */}
        {showRemove && (
          <MenuItem disabled={!liveFileId} onClick={() => handleSelectLiveFile(null)}>
            <ListItemDecorator><ClearIcon /></ListItemDecorator>
            Close
          </MenuItem>
        )}

      </CloseablePopup>
    )}

  </>;
}