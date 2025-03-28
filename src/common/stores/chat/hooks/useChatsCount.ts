import { useChatStore } from '../store-chats';


export function useChatsCount() {
  return useChatStore(({ conversations }) => conversations.length);
}