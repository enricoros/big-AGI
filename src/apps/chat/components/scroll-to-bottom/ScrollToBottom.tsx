import * as React from 'react';

import { Box } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';

import { isBrowser } from '~/common/util/pwaUtils';

import { ScrollToBottomState, UseScrollToBottomProvider } from './useScrollToBottom';


// set this to true to debug this component
const DEBUG_SCROLL_TO_BOTTOM = true;

const BOOTING_TIMEOUT = 400;
const USER_STICKY_MARGIN = 10;


export function ScrollToBottom(props: {
  bootToBottom?: boolean
  stickToBottom?: boolean
  sx?: SxProps
  children: React.ReactNode,
}) {

  // state

  const [state, setState] = React.useState<ScrollToBottomState>({
    stickToBottom: props.stickToBottom || false,
    booting: props.bootToBottom || false,
    atBottom: undefined,
  });

  // track scrollable (for events and to scroll it)
  const scrollableElementRef = React.useRef<HTMLDivElement>(null);

  // track programmatic scrolls
  const isProgrammaticScroll = React.useRef(false);


  // derived state

  const bootToBottom = props.bootToBottom || false;
  const scrollBehavior: ScrollBehavior = state.booting ? 'auto' : 'smooth';


  // [Debugging]
  if (DEBUG_SCROLL_TO_BOTTOM)
    console.log('ScrollToBottom', { ...state });


  // main programmatic scroll to bottom function

  const doScrollToBottom = React.useCallback(() => {
    const scrollable = scrollableElementRef.current;
    if (scrollable) {
      if (DEBUG_SCROLL_TO_BOTTOM)
        console.log(' - doScrollToBottom()', { scrollHeight: scrollable.scrollHeight, offsetHeight: scrollable.offsetHeight });

      // eat the next scroll event
      isProgrammaticScroll.current = true;

      // smooth scrolling only after booting
      scrollable.scrollTo({ top: scrollable.scrollHeight, behavior: scrollBehavior });
    }
  }, [scrollBehavior]);


  /**
   * Booting state reset (after BOOTING_TIMEOUT ms)
   *  - the "Booting" window will scroll instantly instead of smoothly
   */
  React.useEffect(() => {
    if (!state.booting || !isBrowser) return;

    const clearBootingHandler = () => {
      if (DEBUG_SCROLL_TO_BOTTOM)
        console.log(' - booting complete, clearing state');

      setState((state): ScrollToBottomState => ({ ...state, booting: false }));
    };

    // cancelable listener
    const timeout = window.setTimeout(clearBootingHandler, BOOTING_TIMEOUT);
    return () => clearTimeout(timeout);
  }, [state.booting]);


  /**
   * (User) Scroll events listener
   *  - will cancel any state.stickToBottom, if the user dragged the scroll bar
   */
  React.useEffect(() => {
    if (state.booting) return;

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
      const atBottom = scrollable.scrollHeight - scrollable.scrollTop <= scrollable.offsetHeight + USER_STICKY_MARGIN;

      // assume this is = to the user intention
      const stickToBottom = atBottom;

      // update state only if anything changed
      if (state.atBottom !== atBottom || state.stickToBottom !== stickToBottom)
        setState(state => ({ ...state, stickToBottom, atBottom }));
    };

    // cancelable listener (user and programatic scroll events)
    scrollable.addEventListener('scroll', scrollEventsListener);
    return () => scrollable.removeEventListener('scroll', scrollEventsListener);

  }, [state.atBottom, state.booting, state.stickToBottom]);


  /**
   * Underlying element resize events listener
   */
  React.useEffect(() => {
    const scrollable = scrollableElementRef.current;
    if (!scrollable) return;

    const resizeObserver = new ResizeObserver(entries => {
      const resizedEntry = entries.find(entry => entry.target === scrollable);
      if (!resizedEntry) return;

      if (DEBUG_SCROLL_TO_BOTTOM)
        console.log('-> scrollable resized', { ...resizedEntry.borderBoxSize });

      if (state.stickToBottom)
        doScrollToBottom();
    });

    // cancelable listener (resize of scrollable element)
    resizeObserver.observe(scrollable);
    return () => resizeObserver.disconnect();

  }, [state.stickToBottom, doScrollToBottom]);


  // actions for this context

  const notifyBooting = React.useCallback(() => {
    // update state only if we are using the booting framework
    if (bootToBottom) {
      setState(state => ({ ...state, booting: true }));
    }
  }, [bootToBottom]);

  const setStickToBottom = React.useCallback((stick: boolean) => {
    // update state only if anything changed, and scroll to bottom if requested
    if (state.stickToBottom != stick) {
      setState(state => ({ ...state, stickToBottom: stick }));
      if (stick)
        doScrollToBottom();
    }
  }, [doScrollToBottom, state.stickToBottom]);


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