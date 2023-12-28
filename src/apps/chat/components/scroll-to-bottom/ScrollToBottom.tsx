import * as React from 'react';

import { Box } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';

import { ScrollToBottomState, UseScrollToBottomProvider } from './useScrollToBottom';


// set this to true to debug this component
const DEBUG_SCROLL_TO_BOTTOM = true;


const initialState: ScrollToBottomState = {

  // config
  stuckToBottom: false,

  // state
  atTop: true,
  atBottom: false,

};

export function ScrollToBottom(props: { children: React.ReactNode, sx?: SxProps }) {

  // state
  const [state, setState] = React.useState<ScrollToBottomState>(initialState);

  // Create a ref to the scrollable component
  const scrollableRef = React.useRef<HTMLDivElement>(null);

  // actions

  const scrollToBottom = React.useCallback((animated: boolean) => {
    if (DEBUG_SCROLL_TO_BOTTOM) console.log('scrollToBottom');
    const scrollable = scrollableRef.current;
    if (scrollable) {
      console.log('scrollable.scrollHeight', { scrollHeight: scrollable.scrollHeight, offsetHeight: scrollable.offsetHeight });
      scrollable.scrollTo({
        top: scrollable.scrollHeight,
        behavior: animated ? 'smooth' : 'auto',
      });
    }
  }, []);

  const stickToBottom = React.useCallback(() => {
    setState(state => ({ ...state, stuckToBottom: true }));
    scrollToBottom(true);
  }, [scrollToBottom]);

  const freeScroll = React.useCallback(() => {
    setState(state => ({ ...state, stuckToBottom: false }));
  }, []);

  return (
    <UseScrollToBottomProvider value={{ ...state, scrollToBottom, stickToBottom, freeScroll }}>
      <Box ref={scrollableRef} sx={props.sx}>
        {props.children}
      </Box>
    </UseScrollToBottomProvider>
  );
}