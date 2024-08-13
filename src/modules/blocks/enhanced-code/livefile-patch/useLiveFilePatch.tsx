import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Option, Select, Typography } from '@mui/joy';

import { useContextWorkspaceId } from '~/common/stores/workspace/WorkspaceIdProvider';
import { useWorkspaceContentsMetadata } from '~/common/stores/workspace/useWorkspaceContentsMetadata';

import type { LiveFileId, LiveFileMetadata } from '~/common/livefile/liveFile.types';
import { isLiveFileSupported } from '~/common/livefile/store-live-file';
import { useUXLabsStore } from '~/common/state/store-ux-labs';
import { LiveFilePatchIcon } from '~/common/components/icons/LiveFilePatchIcon';


const buttonContainerSx: SxProps = {
  // ml: 'auto',
};


export function useLiveFilePatch(title: string, code: string, isPartial: boolean, isMobile: boolean) {

  // state
  /**
   * Warning: very local.
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
      const lfm = liveFilesMetadata.findLast(lfm => lfm.name === title);
      if (lfm)
        setLiveFileId(lfm.id);
    }
  }, [isEnabled, liveFilesMetadata, title]);


  // reset enablement if no live files
  if (!liveFilesMetadata?.length)
    isEnabled = false;


  // handlers

  const handleLiveFileChange = React.useCallback((event: unknown, value: LiveFileId | null) => {
    setLiveFileId(value);
  }, []);


  // components

  // const

  const button = React.useMemo(() => !isEnabled ? null : (
    <Box sx={buttonContainerSx}>
      <Select
        variant='plain'
        size='sm'
        placeholder='Pair...'
        value={liveFileId}
        onChange={handleLiveFileChange}
        disabled={!liveFilesMetadata.length}
        slotProps={{
          listbox: {
            variant: 'outlined',
            size: 'md',
          },
          indicator: {
            sx: {
              display: 'none',
            },
          },
          endDecorator: {
            // make sure mouse events pass through this
            sx: {
              pointerEvents: 'none',
            },
          },
        }}
        endDecorator={<LiveFilePatchIcon color='success' />}
        sx={buttonContainerSx}
      >
        {liveFilesMetadata.toReversed().map((lfm: LiveFileMetadata) => (
          <Option key={lfm.id} value={lfm.id}>
            {lfm.name}
          </Option>
        ))}
      </Select>
    </Box>
  ), [handleLiveFileChange, isEnabled, liveFileId, liveFilesMetadata]);

  const actionBar = React.useMemo(() => (!isEnabled || !liveFilesMetadata || true) ? null : (
    <Typography sx={buttonContainerSx}>
      {JSON.stringify(liveFilesMetadata)}
    </Typography>
  ), [liveFilesMetadata, isEnabled]);


  return {
    button,
    actionBar,
  };
}
