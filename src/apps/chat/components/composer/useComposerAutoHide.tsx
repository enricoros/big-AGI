import * as React from 'react';

import { useUXLabsStore } from '~/common/stores/store-ux-labs';


// configuration
const HIDE_DELAY = 1500; // milliseconds before hiding after mouse leaves
const FORCE_SHOW_DURATION = 3000; // milliseconds to keep shown after user interaction


const compressibleStyle = {
  minHeight: 0, // makes the compressor collapse this
  overflow: 'hidden', // when collapsing cuts the content
  contain: 'paint', // improves performance by limiting the area to paint

  // Note: the following in the composer's style would make for a much better animation
  // sx={{
  //   // Add slide animation for both beam and auto-hide
  //   transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  //   transform: composerAutoHide.isHidden ? 'translateY(100%)' : 'translateY(0)',
  // }}
} as const;

const _styles = {

  compressorClosed: {
    display: 'grid',
    gridTemplateRows: '0fr',
    transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  } as const,

  compressorOpen: {
    display: 'grid',
    gridTemplateRows: '1fr',
    transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  } as const,

  detector: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '2rem',
    backgroundColor: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.1)',
    // backgroundColor: { xs: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.1)', md: 'transparent' },
    zIndex: 20,
  } as const,

} as const;


export function useComposerAutoHide(forceHide: boolean, isContentful: boolean) {

  // state
  const [isAutoHidden, setAutoHidden] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isHovering, setIsHovering] = React.useState(false);
  const [forceShowUntil, setForceShowUntil] = React.useState<number>(0);

  // external state
  const autoHideEnabled = useUXLabsStore((state) => state.labsAutoHideComposer);

  const hideTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);


  // Force show the composer for a duration (e.g., after sending a message)
  const forceShow = React.useCallback((durationMs: number = FORCE_SHOW_DURATION) => {
    setForceShowUntil(Date.now() + Math.max(1000, durationMs));
    setAutoHidden(false);
  }, []);


  const showComposer = React.useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = undefined;
    }
    setAutoHidden(false);
  }, []);

  const hideComposerDelayed = React.useCallback(() => {
    if (hideTimeoutRef.current)
      clearTimeout(hideTimeoutRef.current);

    hideTimeoutRef.current = setTimeout(() => {
      setAutoHidden(true);
      setIsFocused(false); // reset focus state when hiding
      hideTimeoutRef.current = undefined;
    }, HIDE_DELAY);
  }, []);


  // Effect: Handle auto-hide logic based on various conditions
  const shouldStayVisible = isContentful || isHovering || isFocused || forceShowUntil > Date.now();
  const shouldAutoHide = autoHideEnabled && !shouldStayVisible;
  React.useEffect(() => {
    if (shouldAutoHide)
      hideComposerDelayed();
    else
      showComposer();
  }, [hideComposerDelayed, shouldAutoHide, showComposer]);

  // Clear force show timer when it expires
  React.useEffect(() => {
    if (forceShowUntil > 0) {
      const timeout = setTimeout(() => {
        setForceShowUntil(0);
      }, forceShowUntil - Date.now());

      return () => clearTimeout(timeout);
    }
  }, [forceShowUntil]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (hideTimeoutRef.current)
        clearTimeout(hideTimeoutRef.current);
    };
  }, []);


  const doHide = forceHide || (autoHideEnabled && isAutoHidden);

  const compressorProps = React.useMemo(() => ({
    onMouseEnter: !autoHideEnabled ? undefined : () => setIsHovering(true),
    onMouseLeave: !autoHideEnabled ? undefined : () => setIsHovering(false),
    onFocusCapture: !autoHideEnabled ? undefined : () => setIsFocused(true),
    onBlurCapture: !autoHideEnabled ? undefined : () => setIsFocused(false),
    sx: doHide ? _styles.compressorClosed : _styles.compressorOpen,
  }), [autoHideEnabled, doHide]);

  const detectorProps = React.useMemo(() => ({
    onMouseEnter: () => {
      setIsHovering(true);
      showComposer();
    },
    onMouseLeave: () => {
      setIsHovering(false);
    },
    sx: _styles.detector,
  }), [showComposer]);

  return {
    isHidden: doHide,
    compressorProps,
    compressibleStyle,
    detectorProps,
    forceShow,
  };
}