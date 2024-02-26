import type { DConversationId } from '~/common/state/store-chats';

import { ConversationHandler } from './ConversationHandler';

export class ConversationManager {
  private static _instance: ConversationManager;
  private readonly handlers: Map<DConversationId, ConversationHandler> = new Map();

  static getHandler(conversationId: DConversationId): ConversationHandler {
    const instance = ConversationManager._instance || (ConversationManager._instance = new ConversationManager());
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
