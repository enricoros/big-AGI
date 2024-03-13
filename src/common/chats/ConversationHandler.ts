import { DLLMId, useModelsStore } from '~/modules/llms/store-llms';
import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import { SystemPurposeId, SystemPurposes } from '../../data';

import { ChatActions, createDMessage, DConversationId, DMessage, getConversationSystemPurposeId, useChatStore } from '../state/store-chats';

import { createBeamStore } from '~/common/beam/store-beam';

import { EphemeralHandler, EphemeralsStore } from './EphemeralsStore';


/**
 * ConversationHandler is a class to overlay state onto a conversation.
 * It is a singleton per conversationId.
 *  - View classes will react to this class (or its members) to update the UI.
 *  - Controller classes will call directly methods in this class.
 */
export class ConversationHandler {
  private readonly chatActions: ChatActions;
  private readonly conversationId: DConversationId;

  private readonly beamStore = createBeamStore();
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
  }


  // Beam

  getBeamStore = () => this.beamStore;

  /**
   * Opens a beam on the given history, and only replaces the history once the user accepts the beam
   * Note: make sure the history is adjusted for the System Purpose already, as we won't do it here.
   */
  beamGenerate(newHistory: DMessage[]) {
    // This will replace the conversation history, and use Beam to generate the next 'assistant' message
    const handleReplaceFullHistory = (messageText: string, llmId: DLLMId) => {
      const newMessage = createDMessage('assistant', messageText);
      newMessage.originLLM = llmId;
      newMessage.purposeId = getConversationSystemPurposeId(this.conversationId) ?? undefined;
      this.messagesReplace([...newHistory, newMessage]);
    };

    // open the store
    this.beamStore.getState().open(newHistory, useModelsStore.getState().chatLLMId, handleReplaceFullHistory);
  }

  beamReplaceMessage(viewHistory: Readonly<DMessage[]>, importMessages: DMessage[], replaceMessageId: DMessage['id']): void {
    // This will replace a single message in history after Beam has generated it
    const handleReplaceSingleMessage = (messageText: string, llmId: DLLMId) => {
      this.messageEdit(replaceMessageId, { text: messageText, originLLM: llmId }, true);
    };

    // open the store and import the messages
    const { open: beamOpen, importRays: beamImportRays } = this.beamStore.getState();
    beamOpen(viewHistory, useModelsStore.getState().chatLLMId, handleReplaceSingleMessage);
    beamImportRays(importMessages);
  }


  // Ephemerals

  createEphemeral(title: string, initialText: string): EphemeralHandler {
    return new EphemeralHandler(title, initialText, this.ephemeralsStore);
  }

}
