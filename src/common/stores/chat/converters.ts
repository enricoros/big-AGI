import { SystemPurposeId } from '../../../data';

import { createDConversation, DConversation, type DConversationId } from '~/common/stores/chat/chat.conversation';
import { createDMessageTextContent, DMessage } from '~/common/stores/chat/chat.message';
import { DModelSource } from '~/modules/llms/store-llms';
import { DFolder } from '~/common/state/store-folders';


export namespace V4ToHeadConverters {

  export function inMemCleanDMessage(_m: DMessage): void {

  }

  export function devUpdateAtRestV4s(): void {

  }

}


export namespace DataAtRestV1 {


  /// Rest V1 -> Head ///

  /** Used by: AppLinkChat.fetchStoredChatV1, trade_client.loadSingleChatFromAtRestV1 */
  export function recreateConversation(chatJV1: RestChatJsonV1 & { tokenCount?: number }): DConversation | null {

    // sanity check
    if (!chatJV1 || !chatJV1.id || !chatJV1.messages) {
      console.warn('createDConversationFromJsonV1: invalid conversation json', chatJV1);
      return null;
    }

    // RestChatJsonV1 could be EITHER a V3 or V4/Head message - uncomment below to see little difference
    // const sentinel1: RestChatJsonV1 = {} as DConversation;
    // const sentinel1: DConversation = {} as RestChatJsonV1;
    // TODO: probably better to fork off the saving already, so imports are only V3's

    // heuristic to find out if we're dealing with a V3 or V4 message
    // const v3Count = chatJV1.messages.filter((m) => 'text' in m).length;
    // const v4Count = chatJV1.messages.filter((m) => 'fragments' in m).length;
    // if (v3Count > v4Count) {
    //   we are dealing with a V3 message
    //  ...
    // }

    return V3StoreDataToHead.recreateConversation(chatJV1);
  }

  /** Used by: trade_client.loadConversationsFromAtRestV1 */
  export function recreateFolders(part: RestFolderJsonV1[]): DFolder[] {
    return (part || []).map(_recreateFolder).filter((f) => f) as DFolder[];
  }

  function _recreateFolder(part: RestFolderJsonV1): DFolder | null {

    // sanity check
    if (!part || !part.id || !part.title || !part.conversationIds) {
      console.warn('createFolderFromJsonV1: invalid folder json', part);
      return null;
    }

    return {
      id: part.id,
      title: part.title,
      conversationIds: part.conversationIds,
      color: part.color,
    };
  }


  /// Head -> Rest V1 ///

  /** Used by: downloadAllJsonV1B */
  export function formatAllToJsonV1B(conversations: DConversation[], modelSources: DModelSource[], folders: DFolder[], enableFolders: boolean): RestAllJsonV1B {
    return {
      conversations: (conversations || []).map(formatChatToJsonV1),
      models: { sources: modelSources },
      folders: { folders, enableFolders },
    };
  }

  /** Used by: ^, downloadSingleChat, ChatLinkExport.handleCreate */
  export function formatChatToJsonV1(ec: DConversation): RestChatJsonV1 {
    return {
      id: ec.id,
      messages: ec.messages,
      systemPurposeId: ec.systemPurposeId,
      userTitle: ec.userTitle,
      autoTitle: ec.autoTitle,
      created: ec.created,
      updated: ec.updated,
    };
  }


  /// STORED TYPES definitions ///
  /// do not change(!) these - consider people's backups and stored data

  export type RestAllJsonV1B = {
    conversations: RestChatJsonV1[];
    models: { sources: DModelSource[] };
    folders?: { folders: RestFolderJsonV1[]; enableFolders: boolean };
  }

  export type RestChatJsonV1 = {
    id: string;
    messages: (DMessage | V3StoreDataToHead.ImportMessageV3)[];
    systemPurposeId: string;
    userTitle?: string;
    autoTitle?: string;
    created: number;
    updated: number | null;
  }

  type RestFolderJsonV1 = {
    id: string;
    title: string;
    conversationIds: DConversationId[];
    color?: string; // Optional color property
  }

}


export namespace V3StoreDataToHead {

  /** Used by: chat-store.migrate() for direct data conversion to V4 from V3 */
  export function recreateConversations(ic: ImportConversationV3[]): DConversation[] {
    return (ic || []).map(recreateConversation);
  }

  /** Used by: ^, DataAtRestV1.recreateConversation */
  export function recreateConversation(ic: (
    | ImportConversationV3
    | DataAtRestV1.RestChatJsonV1 /* this is here because a chat at rest JsonV1 basically overlapped with V3 data */
    // | DConversation /* this is here because a V4 could have been exported too, and we want to force type overlaps */
    )): DConversation {
    const {
      id,
      userTitle, autoTitle,
      systemPurposeId,
      messages,
      updated,
      created,
    } = ic;

    const cc = createDConversation(systemPurposeId as SystemPurposeId);
    if (id) cc.id = id;
    cc.messages = messages.map(_recreateMessage);
    if (userTitle) cc.userTitle = userTitle;
    if (autoTitle) cc.autoTitle = autoTitle;
    if (created) cc.created = created;
    if (updated) cc.updated = updated;
    cc.tokenCount = ('tokenCount' in ic) ? ic.tokenCount || 0 : cc.tokenCount || 0;

    return cc;
  }

  function _recreateMessage(im: (ImportMessageV3 | DMessage)): DMessage {
    let cm: DMessage | undefined = _isDMessageV4(im) ? im : undefined;
    if (!cm) {
      const {
        id,
        text,
        role,
        purposeId,
        originLLM,
        metadata,
        userFlags,
        tokenCount,
        created,
        updated,
      } = im as ImportMessageV3;

      cm = createDMessageTextContent(role, text);
      if (id) cm.id = id;
      if (purposeId) cm.purposeId = purposeId;
      if (originLLM) cm.originLLM = originLLM;
      if (metadata) cm.metadata = metadata;
      if (userFlags) cm.userFlags = userFlags;
      cm.tokenCount = tokenCount || 0;
      if (created) cm.created = created;
      if (updated) cm.updated = updated;

    }
    V4ToHeadConverters.inMemCleanDMessage(cm);
    return cm;
  }


  /// Types before the May 2024 Multi-Part refactor. ///

  type ImportConversationV3 = {
    id: string;
    messages: ImportMessageV3[];
    systemPurposeId: string;
    userTitle?: string;
    autoTitle?: string;
    tokenCount: number;
    created: number;
    updated: number | null;
  }

  export type ImportMessageV3 = {
    id: string;
    text: string;                     // big 'tell' that this is a V3 message
    // sender: 'You' | 'Bot' | string;   // (ignored in conversion) pretty name
    // avatar: string | null;            // (ignored in conversion) null, or image url
    // typing: boolean;                  // (ignored in conversion)
    role: 'assistant' | 'system' | 'user';

    purposeId?: string;               // only assistant/system
    originLLM?: string;               // only assistant - model that generated this message, goes beyond known models

    metadata?: {                      // metadata, mainly at creation and for UI
      inReplyToText?: string;         // text this was in reply to
    };
    userFlags?: ('starred')[];             // (UI) user-set per-message flags

    tokenCount: number;               // cache for token count, using the current Conversation model (0 = not yet calculated)

    created: number;                  // created timestamp
    updated: number | null;           // updated timestamp
  }

  function _isDMessageV4(message: DMessage | ImportMessageV3): message is DMessage {
    return 'fragments' in message && Array.isArray(message.fragments);
  }

}
