import * as React from 'react';

import { Box, Dropdown, IconButton, ListItemDecorator, Menu, MenuButton, MenuItem } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import CodeIcon from '@mui/icons-material/Code';

import type { LiveFileId, LiveFileMetadata } from '~/common/livefile/liveFile.types';
import { LiveFilePatchIcon } from '~/common/components/icons/LiveFilePatchIcon';
import { useContextWorkspaceId } from '~/common/stores/workspace/WorkspaceIdProvider';
import { useWorkspaceContentsMetadata } from '~/common/stores/workspace/useWorkspaceContentsMetadata';


/**
 * Allows selection of LiveFiles in the current Workspace
 */
export function WorkspaceLiveFilePicker(props: {
  enabled: boolean;
  autoSelectName: string | null;
  liveFileId: LiveFileId | null;
  onSelectLiveFile: (id: LiveFileId | null) => void;
}) {


  // external state
  const workspaceId = useContextWorkspaceId();
  const { liveFilesMetadata: wLiveFiles } = useWorkspaceContentsMetadata(props.enabled ? workspaceId : null);

  // set as disabled when empty
  const enabled = wLiveFiles.length > 0;
  const { autoSelectName, liveFileId, onSelectLiveFile } = props;


  // [effect] auto-select a LiveFileId
  React.useEffect(() => {
    if (!enabled || !wLiveFiles.length)
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
  }, [enabled, wLiveFiles, autoSelectName, onSelectLiveFile]);


  return (
    <Dropdown>

      {/* Activation button */}
      {/*<TooltipOutlined color='success' title='Apply to LiveFile' placement='top-end'>*/}
      <MenuButton
        aria-label='Pair File'
        slots={{ root: IconButton }}
        slotProps={{
          root: {
            color: liveFileId ? 'success' : undefined,
            // variant: liveFileId ? undefined : undefined,
            size: 'sm',
          },
        }}
        sx={{
          ml: 'auto',
        }}
      >
        <LiveFilePatchIcon />
      </MenuButton>
      {/*</TooltipOutlined>*/}

      {/* List of the Workspace LiveFiles to pair */}
      <Menu
        placement='bottom-start'
        sx={{
          minWidth: 200,
          zIndex: 'var(--joy-zIndex-modal)', /* on top of its own modal in FS */
        }}
      >
        {/*<ListItem>*/}
        {/*  <Typography level='body-sm'>Recent Workspace Files</Typography>*/}
        {/*</ListItem>*/}

        {wLiveFiles.map((lfm: LiveFileMetadata) => (
          <MenuItem
            key={lfm.id}
            selected={lfm.id === liveFileId}
            onClick={() => onSelectLiveFile(lfm.id)}
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

        {/*<ListDivider />*/}

        {!!liveFileId && (
          <MenuItem disabled={!liveFileId} onClick={() => onSelectLiveFile(null)}>
            <ListItemDecorator><ClearIcon /></ListItemDecorator>
            Remove
          </MenuItem>
        )}
      </Menu>
    </Dropdown>
  );
}