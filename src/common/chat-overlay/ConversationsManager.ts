import type { DBlobAssetId } from '~/common/stores/blob/dblobs-portability';
import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { collectFragmentAssetIds, gcRegisterAssetCollector } from '~/common/stores/chat/chat.gc';

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

  private constructor() {
    // Register a GC collector to protect DBlob assets referenced in active Beam stores.
    // Uses inversion of control to avoid circular dependency (chat/ -> chat-overlay/).
    gcRegisterAssetCollector(() => this._collectBeamAssetIds());
  }

  /**
   * Collect DBlob asset IDs from all active Beam stores (rays, fusions, follow-ups).
   */
  private _collectBeamAssetIds(): DBlobAssetId[] {
    const assetIds = new Set<DBlobAssetId>();
    for (const handler of this.handlers.values()) {
      const { rays, fusions } = handler.getBeamStore().getState();

      // Scatter rays + their follow-up messages
      for (const ray of rays) {
        collectFragmentAssetIds(ray.message.fragments, assetIds);
        // if (ray.followUpMessages)
        //   for (const msg of ray.followUpMessages)
        //     collectFragmentAssetIds(msg.fragments, assetIds);
      }

      // Gather fusions + their follow-up messages
      for (const fusion of fusions) {
        if (fusion.outputDMessage)
          collectFragmentAssetIds(fusion.outputDMessage.fragments, assetIds);
        // if (fusion.followUpMessages)
        //   for (const msg of fusion.followUpMessages)
        //     collectFragmentAssetIds(msg.fragments, assetIds);
      }
    }
    return Array.from(assetIds);
  }

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