import type { DConversationId } from '~/common/state/store-chats';

import { ConversationHandler } from './ConversationHandler';

// set to true to enable ref counting debug logs
const DEBUG_REFS = false;


export function conversationManager() {
  return ConversationManager.getInstance();
}


export class ConversationManager {
  private static _instance: ConversationManager;
  private readonly handlers: Map<DConversationId, { handler: ConversationHandler; refCount: number }>;

  static getInstance() {
    return ConversationManager._instance || (ConversationManager._instance = new ConversationManager());
  }

  private constructor() {
    this.handlers = new Map();
  }

  getHandler(conversationId: DConversationId, debugLocation: string): ConversationHandler {
    let entry = this.handlers.get(conversationId);
    if (entry) {
      entry.refCount++;
      if (DEBUG_REFS) console.log(`getHandler: Increased refCount for ${conversationId} at ${debugLocation}. New refCount: ${entry.refCount}`);
    } else {
      const newHandler = new ConversationHandler(conversationId);
      entry = { handler: newHandler, refCount: 1 };
      this.handlers.set(conversationId, entry);
      if (DEBUG_REFS) console.log(`getHandler: Created new handler for ${conversationId} at ${debugLocation}`);
    }
    return entry.handler;
  }

  releaseHandler(handler: ConversationHandler, debugLocation: string): void {
    for (let [conversationId, entry] of this.handlers) {
      if (entry.handler === handler) {
        entry.refCount--;
        if (DEBUG_REFS) console.log(`releaseHandler: Decreased refCount for ${conversationId} at ${debugLocation}. New refCount: ${entry.refCount}`);
        if (entry.refCount === 0) {
          this.handlers.delete(conversationId);
          if (DEBUG_REFS) console.log(`releaseHandler: Deleted handler for ${conversationId} at ${debugLocation}`);
        }
        return;
      }
    }
    console.error(`Handler not found for release at ${debugLocation}`);
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
