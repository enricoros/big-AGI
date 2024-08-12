import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { ListItemDecorator, MenuItem } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';
import { useUXLabsStore } from '~/common/state/store-ux-labs';


/**
 * Small hidden context menu to toggle the code enhancer, globally.
 */
export function EnhancedRenderCodeMenu(props: { anchor: HTMLElement, onClose: () => void }) {

  // state
  const { showPromisedOverlay } = useOverlayComponents();
  const { labsEnhanceCodeBlocks, setLabsEnhanceCodeBlocks } = useUXLabsStore(useShallow(state => ({
    labsEnhanceCodeBlocks: state.labsEnhanceCodeBlocks,
    setLabsEnhanceCodeBlocks: state.setLabsEnhanceCodeBlocks,
  })));

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
        confirmationText='Turn off automatic code enhancements? This will disable LiveFile functionality. You can turn it back on anytime by going to Settings > Labs > Enhance Legacy Code.'
        positiveActionText='Turn Off'
      />,
    ).then(() => setLabsEnhanceCodeBlocks(false)).catch(() => null /* ignore closure */);
  }, [labsEnhanceCodeBlocks, setLabsEnhanceCodeBlocks, showPromisedOverlay]);

  return (
    <CloseableMenu
      dense
      open anchorEl={props.anchor} onClose={props.onClose}
      sx={{ minWidth: 240 }}
    >

      {/* A mix in between UxLabsSettings (labsEnhanceCodeBlocks) and the ChatDrawer MenuItems */}
      <MenuItem onClick={toggleEnhanceCodeBlocks}>
        <ListItemDecorator>{labsEnhanceCodeBlocks && <CheckRoundedIcon />}</ListItemDecorator>
        Enhance Legacy Code
      </MenuItem>

    </CloseableMenu>
  );
}