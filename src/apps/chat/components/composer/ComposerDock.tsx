import * as React from 'react';

import { Box } from '@mui/joy';

import { useIsBeamOpenForConversation } from '~/modules/beam/store-module-beam';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { useOptimaChromeless } from '~/common/layout/optima/useOptima';

import { useLiveSvgStore } from '../live-svg/store-livesvg';

import { useComposerAutoHide } from './useComposerAutoHide';


/**
 * Hosts the Composer with auto-hide. Owns the has-content flag and the hide/hover/focus state, and derives the
 * forced-hide conditions (Beam open in the focused chat, live SVG mode, mobile chromeless) by itself, so none
 * of them re-renders the parent.
 *
 * `children` receives the has-content setter to wire into the Composer's `onComposerHasContent`.
 */
export function ComposerDock(props: {
  conversationId: DConversationId | null; // the focused chat: a Beam open in it hides the composer
  isMobile: boolean;
  children: (setComposerHasContent: (hasContent: boolean) => void) => React.ReactNode;
}) {

  // state
  const [composerHasContent, setComposerHasContent] = React.useState(false);

  // external state
  const isBeamOpen = useIsBeamOpenForConversation(props.conversationId);
  const liveSvgModeActive = useLiveSvgStore((s) => s.modeActive);
  const isChromeless = useOptimaChromeless() && props.isMobile; // auto-hide on Chromeless too

  // not forced when there is no chat: auto-hiding the 'please select a conversation...' state doesn't feel good
  const forceHide = liveSvgModeActive || isChromeless || isBeamOpen;
  const composerAutoHide = useComposerAutoHide(forceHide, composerHasContent);

  // the composer element changes with the parent's render function only, so the dock's own state changes skip it
  const { children } = props;
  const composer = React.useMemo(() => children(setComposerHasContent), [children]);

  return <>
    <Box {...composerAutoHide.compressorProps}>
      <div style={composerAutoHide.compressibleStyle}>
        {composer}
      </div>
    </Box>

    {/* Hover zone for auto-hide */}
    {!forceHide && composerAutoHide.isHidden && <Box {...composerAutoHide.detectorProps} />}
  </>;
}
