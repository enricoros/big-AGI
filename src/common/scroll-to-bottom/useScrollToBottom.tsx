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


// This has been added because one usage of this hook was outside of the provider
const _oocFallback: ScrollToBottomContext = {
  stickToBottom: false,
  booting: false,
  atBottom: false,
  notifyBooting: console.log,
  setStickToBottom: console.log,
  skipNextAutoScroll: () => {
    // ignore - when used by DocAttachmentFragmentPane outside of a provider
  },
} as const;

export const useScrollToBottom = (): ScrollToBottomContext => {

  // NOTE: we are relaxing the 'throw' because when used outside of a provider, we want to simply do nothing

  // const context = React.useContext(UseScrollToBottom);
  // if (!context)
  //   throw new Error('useScrollToBottom must be used within a ScrollToBottomProvider');
  // return context;

  return React.useContext(UseScrollToBottom) ?? _oocFallback;
};