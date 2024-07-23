import * as React from 'react';

/**
 * State is minimal - to keep state machinery stable and simple
 */
export interface ScrollToBottomState {
  // config
  stickToBottom: boolean;

  // state
  booting: boolean;
  atBottom: boolean | undefined;
}

/**
 * Actions are very simplified, for providing a minimal control surface from the outside
 */
export interface ScrollToBottomActions {
  notifyBooting: () => void;
  setStickToBottom: (stick: boolean) => void;
  skipNextAutoScroll: () => void;
}

type ScrollToBottomContext = ScrollToBottomState & ScrollToBottomActions;

const UseScrollToBottom = React.createContext<ScrollToBottomContext | undefined>(undefined);

export const UseScrollToBottomProvider = UseScrollToBottom.Provider;

export const useScrollToBottom = (): ScrollToBottomContext => {
  const context = React.useContext(UseScrollToBottom);
  if (!context)
    throw new Error('useScrollToBottom must be used within a ScrollToBottomProvider');
  return context;
};