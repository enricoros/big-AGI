import * as React from 'react';

import type { ContentScaling } from '~/common/app.theme';

import { ERCDiffModal } from './ERCDiffModal';


export interface DiffContextData {

  // compare this
  baseCode: string | null;
  baseTitle: string;

  // with this
  compareCode: string | null;
  compareTitle: string;

  // whether the comparison is shown
  showDiff: boolean;

  // render-code highlight text
  contextHighlightText: string | null;

}

export interface DiffContextActions {

  // compare this
  setBase: (code: string, title: string) => void;

  // with this
  setCompare: (code: string, title: string) => void;

  // toggle the diff
  setShowDiff: (show: boolean) => void;

  // set the code highlight text
  setContextHighlightText: (text: string | null) => void;

}


const DiffActionsContext = React.createContext<DiffContextActions | undefined>(undefined);

const DiffDataContext = React.createContext<(DiffContextActions & DiffContextData) | undefined>(undefined);


export function useERCDiffActions() {
  return React.useContext(DiffActionsContext);
}

export function useERCDiffContext() {
  return React.useContext(DiffDataContext);
}


export function ERCDiffContextProvider(props: {
  // for the Modal
  title?: React.ReactNode;
  isMobile: boolean;
  contentScaling: ContentScaling;

  // children of this context provider
  children: React.ReactNode
}) {

  // local state
  const [base, _setBaseObj] = React.useState<{ baseCode: string | null, baseTitle: string }>({
    baseCode: null,
    baseTitle: '',
  });
  const [compare, _setCompareObj] = React.useState<{ compareCode: string | null, compareTitle: string }>({
    compareCode: null,
    compareTitle: '',
  });
  const [showDiff, setShowDiff] = React.useState(false);
  const [contextHighlightText, setContextHighlightText] = React.useState<string | null>(null);


  const stableActionsValue = React.useMemo(() => ({
    setBase: (code: string, title: string) => {
      _setBaseObj({ baseCode: code, baseTitle: title });
    },
    setCompare: (code: string, title: string) => {
      _setCompareObj({ compareCode: code, compareTitle: title });
    },
    setShowDiff,
    setContextHighlightText,
  }), []);

  const contextValue = React.useMemo(() => ({
    ...base,
    ...compare,
    showDiff,
    contextHighlightText,
    ...stableActionsValue, // re-inject the same stable actions
  }), [base, compare, contextHighlightText, showDiff, stableActionsValue]);


  return (
    <DiffDataContext.Provider value={contextValue}>
      <DiffActionsContext.Provider value={stableActionsValue}>

        {props.children}

        {/* if selected, show the modal */}
        {showDiff && (
          <ERCDiffModal
            title={props.title}
            isMobile={props.isMobile}
            contentScaling={props.contentScaling}
            diffContext={contextValue}
          />
        )}

      </DiffActionsContext.Provider>
    </DiffDataContext.Provider>
  );
}