import * as React from 'react';

import { Box, Dropdown, IconButton, ListDivider, ListItemDecorator, Menu, MenuButton, MenuItem, Typography } from '@mui/joy';
import CodeIcon from '@mui/icons-material/Code';

import { useContextWorkspaceId } from '~/common/stores/workspace/WorkspaceIdProvider';
import { useWorkspaceContentsMetadata } from '~/common/stores/workspace/useWorkspaceContentsMetadata';

import type { LiveFileId, LiveFileMetadata } from '~/common/livefile/liveFile.types';
import { LiveFilePatchIcon } from '~/common/components/icons/LiveFilePatchIcon';
import { isLiveFileSupported } from '~/common/livefile/store-live-file';
import { useUXLabsStore } from '~/common/state/store-ux-labs';


export function useLiveFilePatch(title: string, code: string, isPartial: boolean, isMobile: boolean) {

  /**
   * state - Warning: very local.
   * This will get wiped just on a component remount - so it's just a temporary solution.
   */
  const [liveFileId, setLiveFileId] = React.useState<LiveFileId | null>(null);

  // external state
  let isEnabled = useUXLabsStore((state) => state.labsEnhanceCodeLiveFile && isLiveFileSupported());
  const workspaceId = useContextWorkspaceId();
  const { liveFilesMetadata } = useWorkspaceContentsMetadata(isEnabled ? workspaceId : null);

  // [effect] auto-select a LiveFileId
  React.useEffect(() => {
    if (liveFilesMetadata.length === 1) {
      // auto-select the only LiveFile
      setLiveFileId(liveFilesMetadata[0].id);
    } else {
      // auto-select matching the title
      const lfm = liveFilesMetadata.find(lfm => lfm.name === title);
      if (lfm)
        setLiveFileId(lfm.id);
    }
  }, [isEnabled, liveFilesMetadata, title]);


  // reset enablement if no live files
  if (!liveFilesMetadata?.length)
    isEnabled = false;


  // handlers


  // components

  const button = React.useMemo(() => !isEnabled ? null : <>


    {/* LiveFile selector */}
    <Dropdown>

      {/*<TooltipOutlined color='success' title='Select a LiveFile to patch'>*/}
      <MenuButton
        aria-label='Pair File'
        slots={{ root: IconButton }}
        slotProps={{
          root: {
            color: liveFileId ? 'success' : undefined,
            variant: liveFileId ? undefined : undefined,
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

        {liveFilesMetadata.map((lfm: LiveFileMetadata) => (
          <MenuItem key={lfm.id} onClick={() => setLiveFileId(lfm.id)}>
            <ListItemDecorator><CodeIcon sx={{ fontSize: 'lg' }} /></ListItemDecorator>
            <Box>
              {lfm.name}
              <Typography level='body-xs'>{lfm.size?.toLocaleString() || '(unknown)'} bytes {lfm.type ? `· ${lfm.type}` : ''}</Typography>
            </Box>
          </MenuItem>
        ))}

        <ListDivider />

        <MenuItem disabled={!liveFileId} onClick={() => setLiveFileId(null)}>
          <ListItemDecorator />
          Remove Pairing
        </MenuItem>
      </Menu>
    </Dropdown>

  </>, [isEnabled, liveFileId, liveFilesMetadata]);


  const actionBar = React.useMemo(() => (!isEnabled || !liveFilesMetadata || true) ? null : (
    <Typography>
      {JSON.stringify(liveFilesMetadata)}
    </Typography>
  ), [liveFilesMetadata, isEnabled]);


  return {
    button,
    actionBar,
  };
}
