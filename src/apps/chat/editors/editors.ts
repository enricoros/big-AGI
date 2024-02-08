import { DLLMId, getKnowledgeMapCutoff } from '~/modules/llms/store-llms';
import { SystemPurposeId, SystemPurposes } from '../../../data';

import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import { createDMessage, DMessage, useChatStore } from '~/common/state/store-chats';


export function createAssistantTypingMessage(conversationId: string, assistantLlmLabel: DLLMId | string /* 'DALL·E' | 'Prodia' | 'react-...' | 'web' */, assistantPurposeId: SystemPurposeId | undefined, text: string): string {
  const assistantMessage: DMessage = createDMessage('assistant', text);
  assistantMessage.typing = true;
  assistantMessage.purposeId = assistantPurposeId;
  assistantMessage.originLLM = assistantLlmLabel;
  useChatStore.getState().appendMessage(conversationId, assistantMessage);
  return assistantMessage.id;
}


export function updatePurposeInHistory(conversationId: string, history: DMessage[], assistantLlmId: DLLMId, purposeId: SystemPurposeId): DMessage[] {
  const systemMessageIndex = history.findIndex(m => m.role === 'system');
  const systemMessage: DMessage = systemMessageIndex >= 0 ? history.splice(systemMessageIndex, 1)[0] : createDMessage('system', '');
  if (!systemMessage.updated && purposeId && SystemPurposes[purposeId]?.systemMessage) {
    systemMessage.purposeId = purposeId;
    systemMessage.text = bareBonesPromptMixer(SystemPurposes[purposeId].systemMessage, assistantLlmId);

    // HACK: this is a special case for the "Custom" persona, to set the message in stone (so it doesn't get updated when switching to another persona)
    if (purposeId === 'Custom')
      systemMessage.updated = Date.now();
  }
  history.unshift(systemMessage);
  useChatStore.getState().setMessages(conversationId, history);
  return history;
}