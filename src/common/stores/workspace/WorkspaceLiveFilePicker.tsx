import * as React from 'react';

import { Box, Button, IconButton, ListDivider, ListItem, ListItemDecorator, MenuItem, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import CodeIcon from '@mui/icons-material/Code';

import type { LiveFileId, LiveFileMetadata } from '~/common/livefile/liveFile.types';
import { CloseableMenu } from '~/common/components/CloseableMenu';
import { LiveFileChooseIcon } from '~/common/livefile/liveFile.icons';
import { LiveFilePatchIcon } from '~/common/components/icons/LiveFilePatchIcon';

import type { DWorkspaceId } from './workspace.types';
import { useWorkspaceContentsMetadata } from './useWorkspaceContentsMetadata';
import { useContextWorkspaceId } from '~/common/stores/workspace/WorkspaceIdProvider';


// configuration
const ENABLE_AUTO_WORKSPACE_PICK = false;


/**
 * Allows selection of LiveFiles in the current Workspace
 */
export function WorkspaceLiveFilePicker(props: {
  autoSelectName: string | null;
  buttonLabel: string;
  liveFileId: LiveFileId | null;
  allowRemove?: boolean;
  onSelectLiveFile: (id: LiveFileId | null) => void;
  onSelectNewFile?: (workspaceId: DWorkspaceId | null) => void;
  // tooltipLabel?: string;
}) {

  // state for anchor
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);

  // external state
  const workspaceId = useContextWorkspaceId();
  const { liveFilesMetadata: wLiveFiles } = useWorkspaceContentsMetadata(workspaceId);

  // set as disabled when empty
  const haveLiveFiles = wLiveFiles.length > 0;
  const { autoSelectName, liveFileId, onSelectLiveFile, onSelectNewFile } = props;


  // [effect] auto-select a LiveFileId
  React.useEffect(() => {
    if (!ENABLE_AUTO_WORKSPACE_PICK || !haveLiveFiles || !wLiveFiles.length)
      return;

    if (wLiveFiles.length === 1) {
      // auto-select the only LiveFile
      onSelectLiveFile(wLiveFiles[0].id);
    } else {
      // auto-select by name
      const lfm = wLiveFiles.find(lfm => lfm.name === autoSelectName);
      if (lfm)
        onSelectLiveFile(lfm.id);
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
    onSelectLiveFile(id);
    setMenuAnchor(null);
  }, [onSelectLiveFile]);

  const handleSelectNewFile = React.useCallback(() => {
    if (onSelectNewFile) {
      onSelectNewFile(workspaceId);
      setMenuAnchor(null);
    }
  }, [onSelectNewFile, workspaceId]);


  // Note: in the future let this be, we can show a file picker that adds LiveFiles to the workspace
  // if (!haveLiveFiles)
  //   return null;

  const showRemove = !!liveFileId && props.allowRemove === true;

  return <>

    {/*<TooltipOutlined*/}
    {/*  title={tooltipLabel} */}
    {/*  color='success'*/}
    {/*  placement='top-end'*/}
    {/*>*/}
    {liveFileId ? (
      <IconButton
        color='success'
        size='sm'
        onClick={handleToggleMenu}
      >
        <LiveFilePatchIcon color='success' />
      </IconButton>
    ) : (
      <Button
        variant='plain'
        color='neutral'
        size='sm'
        onClick={handleToggleMenu}
        endDecorator={<LiveFileChooseIcon color='success' />}
        // endDecorator={<LiveFilePatchIcon color='success' />}
      >
        {props.buttonLabel}
      </Button>
    )}
    {/*</TooltipOutlined>*/}


    {/* Menu: list of workspace files */}
    {!!menuAnchor && (
      <CloseableMenu
        open
        anchorEl={menuAnchor}
        onClose={handleCloseMenu}
        noTopPadding
        noBottomPadding
        placement='bottom-start'
        sx={{ minWidth: 240 }}
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
            <ListItemDecorator><CodeIcon sx={{ fontSize: 'lg' }} /></ListItemDecorator>
            <Box sx={{ fontSize: 'sm' }}>
              {lfm.name}
              <Box component='span' sx={{ fontSize: 'xs', display: 'block', color: 'text.tertiary' }}>
                {lfm.size?.toLocaleString() || '(unknown)'} bytes {lfm.type ? `· ${lfm.type}` : ''}
              </Box>
            </Box>
          </MenuItem>
        ))}

        {/* Pair a new file */}
        {!!props.onSelectNewFile && (
          <MenuItem onClick={handleSelectNewFile} sx={haveLiveFiles ? { minHeight: '3rem' } : undefined}>
            <ListItemDecorator>
              <LiveFileChooseIcon />
            </ListItemDecorator>
            Other target file...
          </MenuItem>
        )}

        {/* Remove pairing */}
        {showRemove && <ListDivider />}
        {showRemove && (
          <MenuItem disabled={!liveFileId} onClick={() => handleSelectLiveFile(null)}>
            <ListItemDecorator><ClearIcon /></ListItemDecorator>
            Remove
          </MenuItem>
        )}

      </CloseableMenu>
    )}

  </>;
}