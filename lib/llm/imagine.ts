import { Prodia } from '@/types/api-prodia';
import { createDMessage, DMessage, useChatStore } from '@/lib/stores/store-chats';
import { useSettingsStore } from '@/lib/stores/store-settings';


export const prodiaDefaultModelId: string = 'v1-5-pruned-emaonly.ckpt [81761151]';


/**
 * The main 'image generation' function - for now specialized to the 'imagine' command.
 */
export const runImageGenerationUpdatingState = async (conversationId: string, history: DMessage[], imageText: string) => {

  // reference the state editing functions
  const { editMessage, setMessages } = useChatStore.getState();

  // create a blank and 'typing' message for the assistant
  let assistantMessageId: string;
  {
    const assistantMessage: DMessage = createDMessage('assistant', `Give me a few seconds while I draw "${imageText}"...`);
    assistantMessageId = assistantMessage.id;
    assistantMessage.typing = true;
    assistantMessage.purposeId = history[0].purposeId;
    assistantMessage.originLLM = 'prodia';
    setMessages(conversationId, [...history, assistantMessage]);
  }

  // generate the image
  const { prodiaApiKey: apiKey, prodiaModelId } = useSettingsStore.getState();
  const input: Prodia.API.Imagine.RequestBody = {
    ...(apiKey && { apiKey }),
    prompt: imageText,
    prodiaModelId: prodiaModelId || prodiaDefaultModelId,
  };

  try {
    const response = await fetch('/api/prodia/imagine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (response.ok) {
      const imagineResponse: Prodia.API.Imagine.Response = await response.json();
      // edit the assistant message to be the image
      if (imagineResponse.status === 'success')
        editMessage(conversationId, assistantMessageId, { text: imagineResponse.imageUrl }, false);
    } else
      editMessage(conversationId, assistantMessageId, { text: `Sorry, I had issues requesting this image. Check your API key?` }, false);
  } catch (error: any) {
    editMessage(conversationId, assistantMessageId, { text: `Sorry, I couldn't generate an image for that. Issue: ${error}.` }, false);
  }
  editMessage(conversationId, assistantMessageId, { typing: false }, false);
};