import { DLLMId, useModelsStore } from '~/modules/llms/store-llms';
import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import { SystemPurposeId, SystemPurposes } from '../../data';

import { ChatActions, createDMessage, DConversationId, DMessage, getConversationSystemPurposeId, useChatStore } from '../state/store-chats';

import { createBeamVanillaStore } from '~/modules/beam/store-beam-vanilla';

import { EphemeralHandler, EphemeralsStore } from './EphemeralsStore';
import { createChatOverlayVanillaStore } from './store-chat-overlay-vanilla';


/**
 * ConversationHandler is a class to overlay state onto a conversation.
 * It is a singleton per conversationId.
 *  - View classes will react to this class (or its members) to update the UI.
 *  - Controller classes will call directly methods in this class.
 */
export class ConversationHandler {
  private readonly chatActions: ChatActions;
  private readonly conversationId: DConversationId;

  private readonly beamStore = createBeamVanillaStore();
  private readonly overlayStore = createChatOverlayVanillaStore();
  readonly ephemeralsStore: EphemeralsStore = new EphemeralsStore();


  constructor(conversationId: DConversationId) {
    this.chatActions = useChatStore.getState();
    this.conversationId = conversationId;
  }


  // Conversation Management

  inlineUpdatePurposeInHistory(history: DMessage[], assistantLlmId: DLLMId | undefined): DMessage[] {
    const purposeId = getConversationSystemPurposeId(this.conversationId);
    const systemMessageIndex = history.findIndex(m => m.role === 'system');
    let systemMessage: DMessage = systemMessageIndex >= 0 ? history.splice(systemMessageIndex, 1)[0] : createDMessage('system', '');
    if (!systemMessage.updated && purposeId && SystemPurposes[purposeId]?.systemMessage) {
      systemMessage.purposeId = purposeId;
      systemMessage.text = bareBonesPromptMixer(SystemPurposes[purposeId].systemMessage, assistantLlmId);

      // HACK: this is a special case for the 'Custom' persona, to set the message in stone (so it doesn't get updated when switching to another persona)
      if (purposeId === 'Custom')
        systemMessage.updated = Date.now();

      // HACK: refresh the object to trigger a re-render of this message
      systemMessage = { ...systemMessage };
    }
    history.unshift(systemMessage);
    // NOTE: disabled on 2024-03-13; we are only manipulating the history in-place, an we'll set it later in every code branch
    // this.chatActions.setMessages(this.conversationId, history);
    return history;
  }

  setAbortController(abortController: AbortController | null): void {
    this.chatActions.setAbortController(this.conversationId, abortController);
  }


  // Message Management

  /**
   * @param text assistant text
   * @param llmLabel LlmId or string, such as 'DALL·E' | 'Prodia' | 'react-...' | 'web'
   * @param purposeId purpose that supposedly triggered this message
   * @param typing whether the assistant is typing at the onset
   */
  messageAppendAssistant(text: string, purposeId: SystemPurposeId | undefined, llmLabel: DLLMId | string, typing: boolean): string {
    const assistantMessage: DMessage = createDMessage('assistant', text);
    assistantMessage.typing = typing;
    assistantMessage.purposeId = purposeId ?? undefined;
    assistantMessage.originLLM = llmLabel;
    this.chatActions.appendMessage(this.conversationId, assistantMessage);
    return assistantMessage.id;
  }

  messageEdit(messageId: string, update: Partial<DMessage>, touch: boolean): void {
    this.chatActions.editMessage(this.conversationId, messageId, update, touch);
  }

  messagesReplace(messages: DMessage[]): void {
    this.chatActions.setMessages(this.conversationId, messages);

    // if zeroing the messages, also terminate an active beam
    if (!messages.length)
      this.beamStore.getState().terminateKeepingSettings();
  }


  // Beam

  getBeamStore = () => this.beamStore;

  /**
   * Opens a beam over the given history
   *
   * @param viewHistory The history up to the point where the beam is invoked
   * @param importMessages If set, any message to import into the beam as pre-set rays
   * @param destReplaceMessageId If set, the output will replace the message with this id, otherwise it will append to the history
   */
  beamInvoke(viewHistory: Readonly<DMessage[]>, importMessages: DMessage[], destReplaceMessageId: DMessage['id'] | null): void {
    const { open: beamOpen, importRays: beamImportRays, terminateKeepingSettings } = this.beamStore.getState();

    const onBeamSuccess = (messageText: string, llmId: DLLMId) => {
      // set output when going back to the chat
      if (destReplaceMessageId) {
        // replace a single message in the conversation history
        this.messageEdit(destReplaceMessageId, { text: messageText, originLLM: llmId }, true);
      } else {
        // replace (may truncate) the conversation history and append a message
        const newMessage = createDMessage('assistant', messageText);
        newMessage.originLLM = llmId;
        newMessage.purposeId = getConversationSystemPurposeId(this.conversationId) ?? undefined;
        this.messagesReplace([...viewHistory, newMessage]);
      }

      // close beam
      terminateKeepingSettings();
    };

    beamOpen(viewHistory, useModelsStore.getState().chatLLMId, onBeamSuccess);
    importMessages.length && beamImportRays(importMessages, useModelsStore.getState().chatLLMId);
  }


  // Ephemerals

  createEphemeral(title: string, initialText: string): EphemeralHandler {
    return new EphemeralHandler(title, initialText, this.ephemeralsStore);
  }


  // Overlay Store

  getOverlayStore = () => this.overlayStore;

}
