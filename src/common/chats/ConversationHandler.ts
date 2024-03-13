import { DLLMId, useModelsStore } from '~/modules/llms/store-llms';
import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import { SystemPurposeId, SystemPurposes } from '../../data';

import { ChatActions, createDMessage, DConversationId, DMessage, useChatStore } from '../state/store-chats';

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

  resyncPurposeInHistory(history: DMessage[], assistantLlmId: DLLMId, purposeId: SystemPurposeId): DMessage[] {
    const systemMessageIndex = history.findIndex(m => m.role === 'system');
    const systemMessage: DMessage = systemMessageIndex >= 0 ? history.splice(systemMessageIndex, 1)[0] : createDMessage('system', '');
    if (!systemMessage.updated && purposeId && SystemPurposes[purposeId]?.systemMessage) {
      systemMessage.purposeId = purposeId;
      systemMessage.text = bareBonesPromptMixer(SystemPurposes[purposeId].systemMessage, assistantLlmId);

      // HACK: this is a special case for the 'Custom' persona, to set the message in stone (so it doesn't get updated when switching to another persona)
      if (purposeId === 'Custom')
        systemMessage.updated = Date.now();
    }
    history.unshift(systemMessage);
    this.chatActions.setMessages(this.conversationId, history);
    return history;
  }

  setAbortController(abortController: AbortController | null): void {
    this.chatActions.setAbortController(this.conversationId, abortController);
  }


  // Message Management

  messageAppendAssistant(text: string, llmLabel: DLLMId | string /* 'DALL·E' | 'Prodia' | 'react-...' | 'web'*/, purposeId?: SystemPurposeId): string {
    const assistantMessage: DMessage = createDMessage('assistant', text);
    assistantMessage.typing = true;
    assistantMessage.purposeId = purposeId;
    assistantMessage.originLLM = llmLabel;
    this.chatActions.appendMessage(this.conversationId, assistantMessage);
    return assistantMessage.id;
  }

  messageEdit(messageId: string, update: Partial<DMessage>, touch: boolean): void {
    this.chatActions.editMessage(this.conversationId, messageId, update, touch);
  }


  // Beam

  getBeamStore = () => this.beamStore;

  beamGenerate(newHistory: DMessage[]) {
    // This will replace the conversation history, and use Beam to generate the next 'assistant' message
    const handleReplaceFullHistory = (messageText: string, llmId: DLLMId) => {
      this.chatActions.setMessages(this.conversationId, newHistory);
      this.messageAppendAssistant(messageText, llmId);
    };
    const { open: beamOpen } = this.beamStore.getState();
    // TODO: resync purpose when opening
    beamOpen(newHistory, useModelsStore.getState().chatLLMId, handleReplaceFullHistory);
  }

  beamReplaceMessage(viewHistory: Readonly<DMessage[]>, importMessages: DMessage[], replaceMessageId: DMessage['id']): void {
    // This will replace a single message in history after Beam has generated it
    const handleReplaceSingleMessage = (messageText: string, llmId: DLLMId) => {
      this.messageEdit(replaceMessageId, { text: messageText, originLLM: llmId }, true);
    };
    const { open: beamOpen, importRays: beamImportRays } = this.beamStore.getState();
    beamOpen(viewHistory, useModelsStore.getState().chatLLMId, handleReplaceSingleMessage);
    beamImportRays(importMessages);
  }


  // Ephemerals

  createEphemeral(title: string, initialText: string): EphemeralHandler {
    return new EphemeralHandler(title, initialText, this.ephemeralsStore);
  }

}
