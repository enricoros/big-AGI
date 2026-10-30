import * as React from 'react';
import { Panel, PanelResizeHandle } from 'react-resizable-panels';

import type { SxProps } from '@mui/joy/styles/types';
import { useTheme } from '@mui/joy';

import type { DiagramConfig } from '~/modules/aifn/digrams/DiagramsModal';
import { useIsBeamOpenForConversation } from '~/modules/beam/store-module-beam';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import { ErrorBoundary } from '~/common/components/ErrorBoundary';
import { PanelResizeInset } from '~/common/components/PanelResizeInset';
import { RenderDecayZone } from '~/common/render-decay/RenderDecayZone';
import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';
import { ScrollToBottomButton } from '~/common/scroll-to-bottom/ScrollToBottomButton';
import { WorkspaceIdProvider } from '~/common/stores/workspace/WorkspaceIdProvider';
import { themeMinWidthChatPane } from '~/common/app.theme';

import { ChatBeamWrapper } from './ChatBeamWrapper';
import { ChatMessageListMemo } from './ChatMessageList';
import { PaneTitleOverlayMemo } from './PaneTitleOverlay';
import { chatPanesActions } from './panes/store-panes-manager';


const _styles = {

  scrollToBottomSx: {
    display: 'flex',
    flexDirection: 'column',
  } as const,

  chatMessageListSx: {
    flexGrow: 1,
  } as const,

  /*chatMessageListBrandedSx: {
    flexGrow: 1,
    backgroundBlendMode: 'soft-light',
    backgroundColor: themeBgApp,
    backgroundImage: 'url(https://...)',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'contain',
  } as const,*/

  chatBeamWrapperSx: {
    flexGrow: 1,
    // we added these after removing the minSize={20} (%) from the containing panel.
    minWidth: themeMinWidthChatPane,
    // minHeight: 'calc(100vh - 69px - var(--AGI-Nav-width))',
  } as const,

} as const satisfies Record<string, SxProps>;


/**
 * One chat pane: the resizable Panel with the message list (or Beam), its title overlay and the separator after it.
 * Memoized: props are primitives and stable handlers, so AppChat renders that do not change this pane skip it.
 * Derives by conversation id what it shows: handler, Beam open (module-store mirror), incognito.
 */
export const ChatPaneMemo = React.memo(ChatPane);

function ChatPane(props: {
  paneId: string,
  paneIdx: number,
  panesCount: number,
  conversationId: DConversationId | null,
  isFocused: boolean,
  composerReachesAll: boolean, // multicast on, or all panes on one chat: non-focused panes tint their border
  isMobile: boolean,
  isZenMode: boolean,
  capabilityHasT2I: boolean,
  isMessageSelectionMode: boolean,
  setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void,
  onConversationBranch: (conversationId: DConversationId, messageId: string, addSplitPane: boolean) => void,
  onConversationDelete: (conversationIds: DConversationId[], bypassConfirmation: boolean) => void,
  onConversationExecuteHistory: (conversationId: DConversationId) => Promise<void>,
  onConversationNew: (forceNoRecycle: boolean, isIncognito: boolean) => void,
  onTextDiagram: (diagramConfig: DiagramConfig | null) => void,
  onTextImagine: (conversationId: DConversationId, selectedText: string) => Promise<void>,
}) {

  const { paneId, paneIdx, panesCount, conversationId, isFocused, isMobile } = props;

  // external state
  const theme = useTheme();
  const chatHandler = React.useMemo(() => conversationId ? ConversationsManager.getHandler(conversationId) : null, [conversationId]);
  const beamStore = chatHandler?.getBeamStore() ?? null;
  const isBeamOpen = useIsBeamOpenForConversation(conversationId) && !!beamStore;
  const isIncognito = chatHandler?.isIncognito() ?? false; // set at creation, never changes for an id

  const isMultiPane = panesCount >= 2;


  // handlers

  const handlePanelClick = React.useCallback((event: React.MouseEvent) => {
    // Alt + Click: undocumented feature to clear focus
    if (event.altKey && panesCount > 1)
      return chatPanesActions().setFocusedPaneIndex(-1);
    chatPanesActions().setFocusedPaneIndex(paneIdx);
  }, [paneIdx, panesCount]);

  const handlePanelCollapse = React.useCallback(() => {
    // NOTE: despite the delay to try to let the dragging settle, there seems to be an issue with the Pane locking the screen
    // setTimeout(() => removePane(idx), 50);
    // more than 2 will result in an assertion from the framework
    if (panesCount === 2)
      chatPanesActions().removePane(paneIdx);
  }, [paneIdx, panesCount]);


  const _keyAndId = `chat-pane-${paneId}`;
  const _sepId = `sep-pane-${paneIdx}`;
  return <WorkspaceIdProvider conversationId={conversationId /*isFocused ? conversationId : null*/}><ErrorBoundary>

    <Panel
      id={_keyAndId}
      order={paneIdx}
      collapsible={panesCount === 2}
      defaultSize={(panesCount === 3 && paneIdx === 1) ? 34 : Math.round(100 / panesCount)}
      // minSize={20 /* IMPORTANT: this forces a reflow even on a simple on hover */}
      onClick={handlePanelClick}
      onCollapse={handlePanelCollapse}
      style={{
        // for anchoring the scroll button in place
        position: 'relative',
        ...(isMultiPane ? {
          marginBottom: '1px', // compensates for the -1px in `composerOpenSx` for the Composer offset
          borderRadius: '0.375rem',
          borderStyle: 'solid',
          borderColor: isFocused
            ? theme.palette.primary.solidBg
            : (props.composerReachesAll ? theme.palette.primary.softActiveBg : theme.palette.divider),
          borderWidth: '2px',
          // borderBottomWidth: '3px',
          // DISABLED on 2024-03-13, it gets in the way quite a lot
          // filter: (!willMulticast && !_paneIsFocused)
          //   ? (!isMultiConversationId ? 'grayscale(66.67%)' /* clone of the same */ : 'grayscale(66.67%)')
          //   : undefined,
          // 2025-02-27: didn't try, here's another version
          // filter: _paneIsFocused ? 'none' : 'brightness(0.94) saturate(0.9)',
        } : {
          // NOTE: this is a workaround for the 'stuck-after-collapse-close' issue. We will collapse the 'other' pane, which
          // will get it removed (onCollapse), and somehow this pane will be stuck with a pointerEvents: 'none' style, which de-facto
          // disables further interaction with the chat. This is a workaround to re-enable the pointer events.
          // The root cause seems to be a Drag state not being reset properly, however the pointerEvents has been set since 0.0.56 while
          // it was optional before: https://github.com/bvaughn/react-resizable-panels/issues/241
          pointerEvents: 'auto',
        }),
        ...((isIncognito && {
          backgroundColor: theme.palette.background.level3,
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.03), rgba(0,0,0,0.03) 10px, transparent 10px, transparent 20px)',
        })),
      }}
    >

      {isMultiPane && !props.isZenMode && (
        <PaneTitleOverlayMemo
          paneIdx={paneIdx}
          conversationId={conversationId}
          isFocused={isFocused}
          isIncognito={isIncognito}
          onConversationDelete={props.onConversationDelete}
        />
      )}

      <ScrollToBottom
        bootToBottom
        stickToBottomInitial
        disableAutoStick={isMobile && isBeamOpen}
        sx={_styles.scrollToBottomSx}
      >

        {!isBeamOpen && (<RenderDecayZone>
          <ChatMessageListMemo
            conversationId={conversationId}
            conversationHandler={chatHandler}
            capabilityHasT2I={props.capabilityHasT2I}
            fitScreen={isMobile || isMultiPane}
            isFocused={isFocused}
            isMobile={isMobile}
            isMessageSelectionMode={props.isMessageSelectionMode}
            setIsMessageSelectionMode={props.setIsMessageSelectionMode}
            onConversationBranch={props.onConversationBranch}
            onConversationExecuteHistory={props.onConversationExecuteHistory}
            onConversationNew={props.onConversationNew}
            onTextDiagram={props.onTextDiagram}
            onTextImagine={props.onTextImagine}
            sx={_styles.chatMessageListSx}
          />
        </RenderDecayZone>)}

        {isBeamOpen && (
          <ChatBeamWrapper
            beamStore={beamStore}
            isFocused={isFocused}
            isMobile={isMobile}
            inlineSx={_styles.chatBeamWrapperSx}
          />
        )}

        {/* Visibility and actions are handled via Context */}
        <ScrollToBottomButton />

      </ScrollToBottom>

    </Panel>

    {/* Panel Separators & Resizers */}
    {paneIdx < panesCount - 1 && (
      <PanelResizeHandle id={_sepId}>
        <PanelResizeInset />
      </PanelResizeHandle>
    )}

  </ErrorBoundary></WorkspaceIdProvider>;
}
