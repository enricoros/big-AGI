import type { DLLMId } from '~/modules/llms/store-llms';
import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import { SystemPurposeId, SystemPurposes } from '../../data';

import { ChatActions, createDMessage, DConversationId, DMessage, useChatStore } from '../state/store-chats';

import { BeamStore } from './BeamStore';
import { EphemeralHandler, EphemeralsStore } from './EphemeralsStore';


export class ConversationHandler {
  private readonly chatActions: ChatActions;
  private readonly conversationId: DConversationId;

  readonly beamStore: BeamStore = new BeamStore();
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


  // Ephemerals

  createEphemeral(title: string, initialText: string): EphemeralHandler {
    return new EphemeralHandler(title, initialText, this.ephemeralsStore);
  }

}


// Singleton to get a global instance relate to a conversationId. Note we don't have reference counting, and mainly because we cannot
// do comprehensive lifecycle tracking.
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