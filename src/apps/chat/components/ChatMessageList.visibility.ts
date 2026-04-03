import type { DMessage } from '~/common/stores/chat/chat.message';


export function getCouncilVisibleMessages(messages: Readonly<DMessage[]>, showSystemMessages: boolean) {
  return messages.filter(message => {
    const messageChannel = message.metadata?.councilChannel?.channel ?? 'public-board';

    if (message.role === 'system')
      return showSystemMessages || messageChannel === 'system';

    return messageChannel === 'public-board' || messageChannel === 'system';
  });
}
