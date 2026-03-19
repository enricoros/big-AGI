import type { SxProps } from '@mui/joy/styles/types';


export const CHAT_MESSAGE_LIST_MINIMAP_TRACK_MAX_RENDER_UNITS = 160;

export function shouldShowConversationMinimapTrack(args: {
  showConversationMinimap: boolean;
  hasDeferredOlderEntries: boolean;
  renderedEntryUnits: number;
}): boolean {
  if (!args.showConversationMinimap || args.hasDeferredOlderEntries)
    return false;

  return args.renderedEntryUnits > 0
    && args.renderedEntryUnits <= CHAT_MESSAGE_LIST_MINIMAP_TRACK_MAX_RENDER_UNITS;
}

export function getChatMessageListConversationOverlayMode(args: {
  isMobile: boolean;
  isMessageSelectionMode: boolean;
  showConversationMinimap: boolean;
  showConversationMinimapTrack?: boolean;
  visibleMessageCount: number;
}): 'hidden' | 'controls' | 'minimap' {
  if (args.isMobile || args.isMessageSelectionMode || args.visibleMessageCount <= 0)
    return 'hidden';

  return args.showConversationMinimap && args.showConversationMinimapTrack !== false
    ? 'minimap'
    : 'controls';
}


export function getChatMessageListContainerSx(baseSx?: SxProps): SxProps {
  return {
    position: 'relative',
    ...baseSx,
  };
}

export function getChatMessageListMinimapOverlaySx(): SxProps {
  return {
    position: 'sticky',
    top: 12,
    zIndex: 3,
    height: 0,
    display: { xs: 'none', md: 'flex' },
    justifyContent: 'flex-end',
    pointerEvents: 'none',
    px: 1,
    pt: 0.5,
    overflow: 'visible',
  };
}
