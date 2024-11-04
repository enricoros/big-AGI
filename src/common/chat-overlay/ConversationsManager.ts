import type { DConversationId } from '~/common/stores/chat/chat.conversation';

import { ConversationHandler } from './ConversationHandler';


/**
 * Singleton to get a global instance related to a conversationId. Note we don't have reference counting, and mainly because we cannot
 * do comprehensive lifecycle tracking.
 *
 * The handlers returned are used for overlaying transitory state on top of DB objects, and to provide utility methods that will survive
 * the former react-state implementation.
 */
export class ConversationsManager {
  private static _instance: ConversationsManager;
  private readonly handlers: Map<DConversationId, ConversationHandler> = new Map();

  static getHandler(conversationId: DConversationId): ConversationHandler {
    const instance = ConversationsManager._instance || (ConversationsManager._instance = new ConversationsManager());
    let handler = instance.handlers.get(conversationId);
    if (!handler) {
      handler = new ConversationHandler(conversationId);
      instance.handlers.set(conversationId, handler);
    }
    return handler;
  }

  // Acquires a ConversationHandler, ensuring automatic release when done, with debug location.
  // enable in 2025, after support from https://github.com/tc39/proposal-explicit-resource-management
  /*usingHandler(conversationId: DConversationId, debugLocation: string) {
    const handler = this.getHandler(conversationId, debugLocation);
    return {
      handler,
      [Symbol.dispose]: () => {
        this.releaseHandler(handler, debugLocation);
      },
    };
  }*/
}