import * as React from 'react';


export interface ScrollToBottomState {

  // config
  stuckToBottom: boolean;

  // state
  atTop: boolean;
  atBottom: boolean;

}

export interface ScrollToBottomActions {

  scrollToBottom: (animated: boolean) => void;

  stickToBottom: () => void;
  freeScroll: () => void;

}

type ScrollToBottomContext = ScrollToBottomState & ScrollToBottomActions;

// React Context with ...state and ...actions
const UseScrollToBottom = React.createContext<ScrollToBottomContext | undefined>(undefined);

export const UseScrollToBottomProvider = UseScrollToBottom.Provider;

export const useScrollToBottom = (): ScrollToBottomState & ScrollToBottomActions => {
  const context = React.useContext(UseScrollToBottom);
  if (!context)
    throw new Error('useScrollToBottom must be used within a ScrollToBottomProvider');
  return context;
};