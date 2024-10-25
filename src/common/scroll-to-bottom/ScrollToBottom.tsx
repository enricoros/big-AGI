/**
 * Copyright (c) 2023-2024 Enrico Ros
 *
 * This subsystem is responsible for 'snap-to-bottom' and 'scroll-to-bottom' features,
 * with an animated, gradual scroll.
 *
 * See the `ScrollToBottomButton` component for the button that triggers the scroll.
 *
 * Example usage:
 *   <ScrollToBottom bootToBottom stickToBottom sx={{ overflowY: 'auto', height: '100%' }}>
 *     <LongMessagesList />
 *     <ScrollToBottomButton />
 *   </ScrollToBottom>
 *
 * Within the Context (children components), functions are made available by using:
 *  const { notifyBooting, setStickToBottom } = useScrollToBottom();
 *
 */
import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { isBrowser } from '~/common/util/pwaUtils';

import { ScrollToBottomState, UseScrollToBottomProvider } from './useScrollToBottom';


// set this to true to debug this component
const DEBUG_SCROLL_TO_BOTTOM = false;

// NOTE: in Chrome a wheel scroll event is 100px
// If you make this too small, the button may show when jumping lines on mobile
// if you make it too large, the user would need a very large flick to unlock the view
const USER_STICKY_MARGIN = 60;

// during the 'booting' timeout, scrolls happen instantly instead of smoothly
const BOOTING_TIMEOUT = 400;


function DebugBorderBox(props: { heightPx: number, color: string }) {
  return (
    <Box sx={{
      position: 'absolute', bottom: 0, right: 0, left: 0,
      height: `${props.heightPx}px`,
      border: `1px solid ${props.color}`,
      pointerEvents: 'none',
    }} />
  );
}

const scrollableBoxSx: SxProps = {
  // allows the content to be scrolled (all browsers)
  overflowY: 'auto',
  // actually make sure this scrolls & fills
  height: '100%',
} as const;


/**
 * This scroller works best with a single oversized child component.
 * The scrollbar (overflowY: 'auto') is handled here.
 *
 * NOTE: the first (possibly only) child shall have { minHeight: '100%' } to auto-fill
 */
export function ScrollToBottom(props: {
  bootToBottom?: boolean,
  bootSmoothly?: boolean,
  stickToBottomInitial?: boolean,
  disableAutoStick?: boolean, // disables auto-sticking when at the bottom - only the button will make it stick
  sx?: SxProps,
  children: React.ReactNode,
}) {

  // state

  const [state, setState] = React.useState<ScrollToBottomState>({
    stickToBottom: props.stickToBottomInitial || false,
    booting: props.bootToBottom || false,
    atBottom: undefined,
  });

  // track scrollable (for events and to scroll it)
  const scrollableElementRef = React.useRef<HTMLDivElement>(null);

  // track programmatic scrolls
  const isProgrammaticScroll = React.useRef(false);

  // skip the next scroll event (when we want to stay where we are)
  const skipNextScrollCounter = React.useRef(0);
  const skipResetTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);


  // derived state

  const bootToBottom = props.bootToBottom || false;
  const scrollBehavior: ScrollBehavior = (state.booting && !props.bootSmoothly) ? 'auto' : 'smooth';


  // [Debugging]
  if (DEBUG_SCROLL_TO_BOTTOM)
    console.log('ScrollToBottom', { ...state });


  // main programmatic scroll to bottom function

  const doScrollToBottom = React.useCallback(() => {
    const scrollable = scrollableElementRef.current;
    if (scrollable) {
      if (DEBUG_SCROLL_TO_BOTTOM)
        console.log('  -> doScrollToBottom()', { scrollHeight: scrollable.scrollHeight, offsetHeight: scrollable.offsetHeight, skipCounter: skipNextScrollCounter.current });

      if (skipNextScrollCounter.current > 0) {
        skipNextScrollCounter.current--;
        if (DEBUG_SCROLL_TO_BOTTOM)
          console.log('  -> Skipping scroll, counter now:', skipNextScrollCounter.current);
        return;
      }

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

    const _clearBootingHandler = () => {
      if (DEBUG_SCROLL_TO_BOTTOM)
        console.log(' -> booting done');

      setState(state => ({ ...state, booting: false }));

      if (bootToBottom)
        doScrollToBottom();
    };

    // cancelable listener
    const timeout = window.setTimeout(_clearBootingHandler, BOOTING_TIMEOUT);
    return () => clearTimeout(timeout);
  }, [bootToBottom, doScrollToBottom, state.booting]);

  /**
   * Children elements resize event listener
   *  - note that the 'scrollable' will likely have a fixed size, while its children are the ones who become scrollable
   */
  React.useEffect(() => {
    const scrollable = scrollableElementRef.current;
    if (!scrollable) return;

    const _containerResizeObserver = new ResizeObserver(entries => {
      if (DEBUG_SCROLL_TO_BOTTOM)
        console.log(' -> scrollable children resized', entries.length);

      // Edge case: when the content is smaller, we need to reset the bottom state (#312)
      const atTop = scrollable.scrollTop == 0;
      const unScrollable = scrollable.scrollHeight <= scrollable.offsetHeight;
      if (unScrollable && atTop) {
        if (DEBUG_SCROLL_TO_BOTTOM)
          console.log('   -> large enough window', entries.length);

        // udpate state only if this changed
        setState(state => (state.atBottom !== true)
          ? ({ ...state, atBottom: true })
          : state,
        );
      }

      if (entries.length > 0 && state.stickToBottom)
        doScrollToBottom();
    });

    // cancelable observer of resize of scrollable's children elements
    Array.from(scrollable.children).forEach(child => _containerResizeObserver.observe(child));
    return () => _containerResizeObserver.disconnect();

  }, [state.stickToBottom, doScrollToBottom]);

  /**
   * (User) Scroll events listener
   *  - will cancel any state.stickToBottom, if the user dragged the scroll bar
   */
  React.useEffect(() => {
    if (state.booting) return;

    const scrollable = scrollableElementRef.current;
    if (!scrollable) return;

    const _scrollEventsListener = () => {
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
      setState(state => state.stickToBottom !== stickToBottom || state.atBottom !== atBottom
        ? {
          ...state,
          stickToBottom: props.disableAutoStick ? (state.stickToBottom && stickToBottom) : stickToBottom,
          atBottom,
        }
        : state,
      );
    };

    // _scrollEventsListener(true);

    // cancelable listener (user and programatic scroll events)
    scrollable.addEventListener('scroll', _scrollEventsListener);
    return () => scrollable.removeEventListener('scroll', _scrollEventsListener);

  }, [props.disableAutoStick, state.booting]);

  /**
   * Cleanup the skipNextScrollCounter
   */
  React.useEffect(() => {
    return () => {
      if (skipResetTimeoutRef.current) {
        clearTimeout(skipResetTimeoutRef.current);
        skipResetTimeoutRef.current = null;
      }
    };
  }, []);


  // actions for this context

  const notifyBooting = React.useCallback(() => {
    if (bootToBottom)
      setState(state => state.booting ? state : ({ ...state, booting: true }));
  }, [bootToBottom]);

  /*const notifyContentUpdated = React.useCallback(() => {
    if (DEBUG_SCROLL_TO_BOTTOM)
      console.log('-= notifyContentUpdated');

    if (state.stickToBottom)
      doScrollToBottom();
  }, [doScrollToBottom, state.stickToBottom]);*/

  const setStickToBottom = React.useCallback((stickToBottom: boolean) => {
    if (DEBUG_SCROLL_TO_BOTTOM)
      console.log('-= setStickToBottom', stickToBottom);

    setState(state => state.stickToBottom !== stickToBottom
      ? ({ ...state, stickToBottom })
      : state,
    );

    if (stickToBottom)
      doScrollToBottom();
  }, [doScrollToBottom]);

  const skipNextAutoScroll = React.useCallback(() => {
    skipNextScrollCounter.current += 2;
    if (DEBUG_SCROLL_TO_BOTTOM)
      console.log('  -> Skip next scroll requested, counter now:', skipNextScrollCounter.current);

    // Clear any existing timeout
    if (skipResetTimeoutRef.current)
      clearTimeout(skipResetTimeoutRef.current);

    // Set a new timeout to reset the counter if not used
    skipResetTimeoutRef.current = setTimeout(() => {
      if (skipNextScrollCounter.current > 0) {
        if (DEBUG_SCROLL_TO_BOTTOM)
          console.log('  -> Resetting unused skip counter');
        skipNextScrollCounter.current = 0;
      }
    }, 200); // Reset after 0.25 seconds if not used
  }, []);


  return (
    <UseScrollToBottomProvider value={{
      ...state,
      notifyBooting,
      setStickToBottom,
      skipNextAutoScroll,
    }}>
      {/* Scrollable v-maxed */}
      <Box ref={scrollableElementRef} role={'scrollable' /* hardcoded, important */} sx={!props.sx ? scrollableBoxSx : ({
        ...scrollableBoxSx,
        ...props.sx,
      } as SxProps)}>
        {props.children}
        {DEBUG_SCROLL_TO_BOTTOM && <DebugBorderBox heightPx={USER_STICKY_MARGIN} color='red' />}
        {DEBUG_SCROLL_TO_BOTTOM && <DebugBorderBox heightPx={100} color='blue' />}
      </Box>
    </UseScrollToBottomProvider>
  );
}