import * as React from 'react';

import { Box } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';

import { ScrollToBottomState, UseScrollToBottomProvider } from './useScrollToBottom';


// set this to true to debug this component
const DEBUG_SCROLL_TO_BOTTOM = true;
const STICKY_MARGIN = 10;


export function ScrollToBottom(props: {
  bootToBottom?: boolean
  stickToBottom?: boolean
  sx?: SxProps
  children: React.ReactNode,
}) {

  // state
  const [state, setState] = React.useState<ScrollToBottomState>({
    bootToBottom: props.bootToBottom || false,
    stickToBottom: props.stickToBottom || false,
    booting: true,
    atTop: undefined,
    atBottom: undefined,
  });

  // ref: track scrollable (for events and to scroll it)
  const scrollableElementRef = React.useRef<HTMLDivElement>(null);

  // ref: track programmatic scroll
  const isProgrammaticScroll = React.useRef(false);


  // scroll (on button press, on new content)

  const doScrollToBottom = React.useCallback(() => {
    const scrollable = scrollableElementRef.current;
    if (scrollable) {
      if (DEBUG_SCROLL_TO_BOTTOM)
        console.log(' -> s2b:', { scrollHeight: scrollable.scrollHeight, offsetHeight: scrollable.offsetHeight });

      // eat the next scroll event
      isProgrammaticScroll.current = true;

      // smooth scrolling only after booting
      scrollable.scrollTo({ top: scrollable.scrollHeight, behavior: state.booting ? 'auto' : 'smooth' });
    }
  }, [state.booting]);


  /**
   * Scroll events listener
   *
   * 1. "Booting" cleared after a timeout, after which:
   * 2. Detect User Scroll
   *  - will cancel any state.stickToBottom, if the user dragged the scroll bar
   */
  React.useEffect(() => {

    // Booting: clear booting state after a timeout
    if (state.booting) {
      const timeout = setTimeout(() => {
        if (DEBUG_SCROLL_TO_BOTTOM)
          console.log(' - booting: cleared');
        setState((state): ScrollToBottomState => ({ ...state, booting: false }));
      }, 200);
      return () => clearTimeout(timeout);
    }

    // Booted: detect user scroll
    const scrollable = scrollableElementRef.current;
    if (!scrollable) return;

    const scrollEventsListener = () => {
      // ignore scroll events during programmatic scrolls
      // NOTE: some will go through, but somewhat the framework is stable
      if (isProgrammaticScroll.current) {
        isProgrammaticScroll.current = false;
        return;
      }

      // compute intersections
      const atTop = scrollable.scrollTop === 0;
      const atBottom = scrollable.scrollHeight - scrollable.scrollTop <= scrollable.offsetHeight + STICKY_MARGIN;

      // assume this is = to the user intention
      const stickToBottom = atBottom;
      setState(state => ({ ...state, stickToBottom, atTop, atBottom }));
    };

    // listen to scroll events (both user and programmatic)
    scrollable.addEventListener('scroll', scrollEventsListener);
    return () => scrollable.removeEventListener('scroll', scrollEventsListener);

  }, [state.booting]);


  // context actions

  const notifyBooting = React.useCallback(() => {
    setState((state): ScrollToBottomState => ({ ...state, booting: true }));
  }, []);

  const setStickToBottom = React.useCallback((stick: boolean) => {
    if (state.stickToBottom == stick) return;
    setState((state): ScrollToBottomState => ({ ...state, stickToBottom: stick }));
    if (stick)
      doScrollToBottom();
  }, [doScrollToBottom, state.stickToBottom]);


  if (DEBUG_SCROLL_TO_BOTTOM)
    console.log('s2b:', { ...state });


  return (
    <UseScrollToBottomProvider value={{
      ...state,
      notifyBooting,
      setStickToBottom,
    }}>
      <Box ref={scrollableElementRef} sx={props.sx}>
        {props.children}
      </Box>
    </UseScrollToBottomProvider>
  );
}