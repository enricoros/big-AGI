import * as React from 'react';

import type { ChatExecuteMode } from './execute-mode.types';
import { ExecuteModeMenu } from './ExecuteModeMenu';
import { ExecuteModeItems } from './execute-mode.items';


export function chatExecuteModeCanAttach(chatExecuteMode: ChatExecuteMode) {
  return !!ExecuteModeItems[chatExecuteMode]?.canAttach;
}


export function useChatExecuteMode(capabilityHasT2I: boolean, isMobile: boolean) {

  // state
  const [chatExecuteMode, setChatExecuteMode] = React.useState<ChatExecuteMode>('generate-content');
  const [chatExecuteModeMenuAnchor, setChatExecuteModeMenuAnchor] = React.useState<HTMLAnchorElement | null>(null);


  const handleMenuHide = React.useCallback(() => setChatExecuteModeMenuAnchor(null), []);

  const handleMenuShow = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    setChatExecuteModeMenuAnchor(anchor => anchor ? null : event.currentTarget);
  }, []);

  const handleChangeMode = React.useCallback((mode: ChatExecuteMode) => {
    handleMenuHide();
    setChatExecuteMode(mode);
  }, [handleMenuHide]);


  const chatExecuteMenuComponent = React.useMemo(() => !!chatExecuteModeMenuAnchor && (
    <ExecuteModeMenu
      isMobile={isMobile}
      hasCapabilityT2I={capabilityHasT2I}
      anchorEl={chatExecuteModeMenuAnchor}
      onClose={handleMenuHide}
      chatExecuteMode={chatExecuteMode}
      onSetChatExecuteMode={handleChangeMode}
    />
  ), [capabilityHasT2I, chatExecuteMode, chatExecuteModeMenuAnchor, handleMenuHide, handleChangeMode, isMobile]);


  return {
    chatExecuteMode,
    chatExecuteMenuComponent,
    chatExecuteModeSendColor: ExecuteModeItems[chatExecuteMode]?.sendColor || 'primary',
    chatExecuteModeSendLabel: ExecuteModeItems[chatExecuteMode]?.sendText || 'Send',
    chatExecuteMenuShown: !!chatExecuteModeMenuAnchor,
    showChatExecuteMenu: handleMenuShow,
  };
}
