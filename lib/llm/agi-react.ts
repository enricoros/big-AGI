import { ApiChatInput, ApiChatResponse } from '../../pages/api/openai/chat';
import { ChatModelId, SystemPurposeId } from '@/lib/data';
import { DMessage, useChatStore } from '@/lib/stores/store-chats';
import { OpenAIAPI } from '@/types/api-openai';
import { createAssistantTypingMessage, updatePurposeInHistory } from '@/lib/llm/agi-immediate';
import { getOpenAIConfiguration, useSettingsStore } from '@/lib/stores/store-settings';


/**
 * Synchronous ReAct chat function - TODO: event loop, auto-ui, cleanups, etc.
 */
export const runReActUpdatingState = async (conversationId: string, history: DMessage[], assistantModelId: ChatModelId, systemPurposeId: SystemPurposeId) => {

  // update the system message from the active Purpose, if not manually edited
  history = updatePurposeInHistory(conversationId, history, systemPurposeId);

  // create a blank and 'typing' message for the assistant
  const assistantMessageId = createAssistantTypingMessage(conversationId, history, assistantModelId);


  // main state updater during the full duration of this
  const { editMessage } = useChatStore.getState();
  const updateAssistantMessage = (update: Partial<DMessage>) => editMessage(conversationId, assistantMessageId, update, false);


  try {
    const response = await getLLMChatResponse(assistantModelId, history.map(({ role, text }) => ({
      role: role,
      content: text,
    })));

    updateAssistantMessage({ text: response.message.content });

  } catch (error: any) {

    console.error(error);
    updateAssistantMessage({ text: `Issue: ${error || 'unknown'}` });

  }


  // stop the typing animation
  updateAssistantMessage({ typing: false });

};


async function getLLMChatResponse(model: ChatModelId, messages: OpenAIAPI.Chat.Message[]): Promise<ApiChatResponse> {

  // use api values from Settings
  const { modelTemperature: temperature } = useSettingsStore.getState();
  const payload: ApiChatInput = {
    api: getOpenAIConfiguration(),
    model,
    messages,
    temperature,
  };

  const response = await fetch('/api/openai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok)
    throw new Error(`Error ${response.status} ${response.statusText}`);

  return await response.json();
}