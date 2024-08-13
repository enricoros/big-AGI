import * as React from 'react';

import { Typography } from '@mui/joy';

import { useContextWorkspaceId } from '~/common/stores/workspace/WorkspaceIdProvider';

import type { LiveFileId } from '~/common/livefile/liveFile.types';
import { SxProps } from '@mui/joy/styles/types';
import { isLiveFileSupported } from '~/common/livefile/store-live-file';
import { useUXLabsStore } from '~/common/state/store-ux-labs';


const buttonContainerSx: SxProps = {
  ml: 'auto',
};


export function useLiveFilePatch(title: string, code: string, isPartial: boolean, isMobile: boolean) {

  /**
   * (very) local state
   * This will get wiped just on a component remount - so it's just a temporary 'solution'.
   */
  const [liveFileId, setLiveFileId] = React.useState<LiveFileId | null>(null);

  // state
  const isEnabled = useUXLabsStore((state) => state.labsEnhanceCodeLiveFile && isLiveFileSupported());
  console.log('isEnabled', isEnabled);

  // components

  const button = React.useMemo(() => !isEnabled ? null : (
    <Typography sx={buttonContainerSx}>
      {liveFileId || 'aaa'}
    </Typography>
  ), [isEnabled, liveFileId]);

  const actionBar = React.useMemo(() => (!isEnabled || !liveFileId) ? null : (
    <Typography sx={buttonContainerSx}>
      test
    </Typography>
  ), [isEnabled, liveFileId]);

  const workspaceId = useContextWorkspaceId();

  return {
    button,
    actionBar,
  };
}
