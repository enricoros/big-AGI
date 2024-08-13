import * as React from 'react';

import { Box, Typography } from '@mui/joy';

import { useContextWorkspaceId } from '~/common/stores/workspace/WorkspaceIdProvider';
import { useWorkspaceContentsMetadata } from '~/common/stores/workspace/useWorkspaceContentsMetadata';

import type { LiveFileId } from '~/common/livefile/liveFile.types';
import { isLiveFileSupported } from '~/common/livefile/store-live-file';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import { WorkspaceLiveFilePicker } from './WorkspaceLiveFilePicker';


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


  // reset enablement if no live files
  if (!liveFilesMetadata?.length)
    isEnabled = false;


  // handlers


  // components

  const button = React.useMemo(() => !isEnabled ? null : (

    <Box sx={{ ml: 'auto' }}>

      <WorkspaceLiveFilePicker
        autoSelectName={title}
        buttonLabel='Apply to ...'
        enabled={isEnabled}
        liveFileId={liveFileId}
        onSelectLiveFile={setLiveFileId}
      />

    </Box>

  ), [isEnabled, liveFileId, title]);


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
