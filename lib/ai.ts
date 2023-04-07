import { ApiChatInput, ApiChatMessage } from '../pages/api/openai/stream-chat';
import { DMessage } from '@/lib/store-chats';


/**
 * Main function to send the chat to the assistant and receive a response (streaming)
 */
export async function streamAssistantMessageEdits(
  conversationId: string, assistantMessageId: string, history: DMessage[],
  apiKey: string | undefined, apiHost: string | undefined, apiOrgId: string | undefined,
  chatModelId: string, modelTemperature: number, modelMaxResponseTokens: number,
  editMessage: (conversationId: string, messageId: string, updatedMessage: Partial<DMessage>, touch: boolean) => void,
  abortSignal: AbortSignal,
) {

  const chatMessages: ApiChatMessage[] = history.map(({ role, text }) => ({
    role: role,
    content: text,
  }));

  const payload: ApiChatInput = {
    ...(apiKey && { apiKey }),
    ...(apiHost && { apiHost }),
    ...(apiOrgId && { apiOrgId }),
    model: chatModelId,
    messages: chatMessages,
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
      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        incrementalText += decoder.decode(value);

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