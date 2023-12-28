import * as React from 'react';


export interface ScrollToBottomState {
  // config
  bootToBottom: boolean;
  stickToBottom: boolean;

  // state
  booting: boolean;
  atTop: boolean | undefined;
  atBottom: boolean | undefined;
}

export interface ScrollToBottomActions {
  notifyBooting: () => void;
  setStickToBottom: (stick: boolean) => void;
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