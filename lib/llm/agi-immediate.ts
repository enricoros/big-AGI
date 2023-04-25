import { ApiChatInput } from '../../pages/api/openai/chat';
import { ChatModelId, SystemPurposeId, SystemPurposes } from '@/lib/data';
import { createDMessage, DMessage, useChatStore } from '@/lib/stores/store-chats';
import { speakIfFirstLine } from '@/lib/util/text-to-speech';
import { updateAutoConversationTitle } from '@/lib/llm/ai';
import { useSettingsStore } from '@/lib/stores/store-settings';


/**
 * The main "chat" function. TODO: this is here so we can soon move it to the data model.
 */
export const runAssistantUpdatingState = async (conversationId: string, history: DMessage[], assistantModel: ChatModelId, systemPurpose: SystemPurposeId) => {

  // update the system message from the active Purpose, if not manually edited
  history = updatePurposeInHistory(conversationId, history, systemPurpose);

  // create a blank and 'typing' message for the assistant
  const assistantMessageId = createAssistantTypingMessage(conversationId, history, assistantModel);

  // when an abort controller is set, the UI switches to the "stop" mode
  const controller = new AbortController();
  const { startTyping, editMessage } = useChatStore.getState();
  startTyping(conversationId, controller);

  const { apiKey, apiHost, apiOrganizationId, modelTemperature, modelMaxResponseTokens } = useSettingsStore.getState();
  await streamAssistantMessage(conversationId, assistantMessageId, history, apiKey, apiHost, apiOrganizationId, assistantModel, modelTemperature, modelMaxResponseTokens, editMessage, controller.signal, speakIfFirstLine);

  // clear to send, again
  startTyping(conversationId, null);

  // update text, if needed
  await updateAutoConversationTitle(conversationId);
};


export function updatePurposeInHistory(conversationId: string, history: DMessage[], purposeId: SystemPurposeId): DMessage[] {
  const systemMessageIndex = history.findIndex(m => m.role === 'system');
  const systemMessage: DMessage = systemMessageIndex >= 0 ? history.splice(systemMessageIndex, 1)[0] : createDMessage('system', '');
  if (!systemMessage.updated && purposeId) {
    systemMessage.purposeId = purposeId;
    systemMessage.text = SystemPurposes[purposeId]?.systemMessage?.replaceAll('{{Today}}', new Date().toISOString().split('T')[0]);
  }
  history.unshift(systemMessage);
  useChatStore.getState().setMessages(conversationId, history);
  return history;
}

export function createAssistantTypingMessage(conversationId: string, history: DMessage[], assistantModel: ChatModelId): string {
  const assistantMessage: DMessage = createDMessage('assistant', '...');
  assistantMessage.typing = true;
  assistantMessage.purposeId = history[0].purposeId;
  assistantMessage.originLLM = assistantModel;
  useChatStore.getState().appendMessage(conversationId, assistantMessage);
  return assistantMessage.id;
}


/**
 * Main function to send the chat to the assistant and receive a response (streaming)
 */
async function streamAssistantMessage(
  conversationId: string, assistantMessageId: string, history: DMessage[],
  apiKey: string | undefined, apiHost: string | undefined, apiOrganizationId: string | undefined,
  chatModelId: string, modelTemperature: number, modelMaxResponseTokens: number,
  editMessage: (conversationId: string, messageId: string, updatedMessage: Partial<DMessage>, touch: boolean) => void,
  abortSignal: AbortSignal,
  onFirstParagraph?: (firstParagraph: string) => void,
) {

  const payload: ApiChatInput = {
    api: {
      ...(apiKey && { apiKey }),
      ...(apiHost && { apiHost }),
      ...(apiOrganizationId && { apiOrganizationId }),
    },
    model: chatModelId,
    messages: history.map(({ role, text }) => ({
      role: role,
      content: text,
    })),
    temperature: modelTemperature,
    max_tokens: modelMaxResponseTokens,
  };

  try {

    const response = await fetch('/api/openai/stream-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: abortSignal,
    });

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      // loop forever until the read is done, or the abort controller is triggered
      let incrementalText = '';
      let parsedFirstPacket = false;
      let sentFirstParagraph = false;
      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        incrementalText += decoder.decode(value, { stream: true });

        // there may be a JSON object at the beginning of the message, which contains the model name (streaming workaround)
        if (!parsedFirstPacket && incrementalText.startsWith('{')) {
          const endOfJson = incrementalText.indexOf('}');
          if (endOfJson > 0) {
            const json = incrementalText.substring(0, endOfJson + 1);
            incrementalText = incrementalText.substring(endOfJson + 1);
            try {
              const parsed = JSON.parse(json);
              editMessage(conversationId, assistantMessageId, { originLLM: parsed.model }, false);
              parsedFirstPacket = true;
            } catch (e) {
              // error parsing JSON, ignore
              console.log('Error parsing JSON: ' + e);
            }
          }
        }

        // if the first paragraph (after the first packet) is complete, call the callback
        if (parsedFirstPacket && onFirstParagraph && !sentFirstParagraph) {
          let cutPoint = incrementalText.lastIndexOf('\n');
          if (cutPoint < 0)
            cutPoint = incrementalText.lastIndexOf('. ');
          if (cutPoint > 100 && cutPoint < 400) {
            const firstParagraph = incrementalText.substring(0, cutPoint);
            onFirstParagraph(firstParagraph);
            sentFirstParagraph = true;
          }
        }

        editMessage(conversationId, assistantMessageId, { text: incrementalText }, false);
      }
    }

  } catch (error: any) {
    if (error?.name === 'AbortError') {
      // expected, the user clicked the "stop" button
    } else {
      // TODO: show an error to the UI
      console.error('Fetch request error:', error);
    }
  }

  // finally, stop the typing animation
  editMessage(conversationId, assistantMessageId, { typing: false }, false);
}