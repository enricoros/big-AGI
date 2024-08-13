import * as React from 'react';

import { Box, Button, IconButton, ListDivider, ListItemDecorator, MenuItem } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import CodeIcon from '@mui/icons-material/Code';

import type { LiveFileId, LiveFileMetadata } from '~/common/livefile/liveFile.types';
import { CloseableMenu } from '~/common/components/CloseableMenu';
import { LiveFilePatchIcon } from '~/common/components/icons/LiveFilePatchIcon';

import { useContextWorkspaceId } from './WorkspaceIdProvider';
import { useWorkspaceContentsMetadata } from './useWorkspaceContentsMetadata';


/**
 * Allows selection of LiveFiles in the current Workspace
 */
export function WorkspaceLiveFilePicker(props: {
  autoSelectName: string | null;
  buttonLabel: string;
  liveFileId: LiveFileId | null;
  onSelectLiveFile: (id: LiveFileId | null) => void;
  // tooltipLabel?: string;
}) {

  // state for anchor
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);

  // external state
  const workspaceId = useContextWorkspaceId();
  const { liveFilesMetadata: wLiveFiles } = useWorkspaceContentsMetadata(workspaceId);

  // set as disabled when empty
  const haveLiveFiles = wLiveFiles.length > 0;
  const { autoSelectName, liveFileId, onSelectLiveFile } = props;


  // [effect] auto-select a LiveFileId
  React.useEffect(() => {
    if (!haveLiveFiles || !wLiveFiles.length)
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


  // Note: in the future let this be, we can show a file picker that adds LiveFiles to the workspace
  if (!haveLiveFiles)
    return null;

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
        endDecorator={<LiveFilePatchIcon />}
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
        placement='bottom-start'
      >

        {/*<ListItem>*/}
        {/*  <Typography level='body-sm'>Recent Workspace Files</Typography>*/}
        {/*</ListItem>*/}

        {wLiveFiles.map((lfm: LiveFileMetadata) => (
          <MenuItem
            key={lfm.id}
            selected={lfm.id === liveFileId}
            onClick={() => handleSelectLiveFile(lfm.id)}
          >
            <ListItemDecorator><CodeIcon sx={{ fontSize: 'lg' }} /></ListItemDecorator>
            <Box>
              {lfm.name}
              <Box component='span' sx={{ fontSize: 'xs', display: 'block' }}>
                {lfm.size?.toLocaleString() || '(unknown)'} bytes {lfm.type ? `· ${lfm.type}` : ''}
              </Box>
            </Box>
          </MenuItem>
        ))}

        {!!liveFileId && <ListDivider />}
        {!!liveFileId && (
          <MenuItem disabled={!liveFileId} onClick={() => handleSelectLiveFile(null)}>
            <ListItemDecorator><ClearIcon /></ListItemDecorator>
            Remove
          </MenuItem>
        )}

      </CloseableMenu>
    )}

  </>;
}