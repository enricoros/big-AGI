import { Prodia } from '@/modules/prodia/prodia.types';
import { prodiaDefaultModelId } from '@/modules/prodia/prodia.client';

import { useChatStore } from '@/common/state/store-chats';
import { useSettingsStore } from '@/common/state/store-settings';

import { createAssistantTypingMessage } from './agi-immediate';


/**
 * The main 'image generation' function - for now specialized to the 'imagine' command.
 */
export const runImageGenerationUpdatingState = async (conversationId: string, imageText: string) => {

  // reference the state editing functions
  const { editMessage } = useChatStore.getState();

  // create a blank and 'typing' message for the assistant
  const assistantMessageId = createAssistantTypingMessage(conversationId, 'prodia', undefined,
    `Give me a few seconds while I draw ${imageText?.length > 20 ? 'that' : '"' + imageText + '"'}...`);

  // generate the image
  const { prodiaApiKey: apiKey, prodiaModelId, prodiaNegativePrompt: negativePrompt, prodiaSteps: steps, prodiaCfgScale: cfgScale, prodiaSeed: seed } = useSettingsStore.getState();
  const input: Prodia.API.Imagine.RequestBody = {
    ...(apiKey && { apiKey }),
    prompt: imageText,
    prodiaModelId: prodiaModelId || prodiaDefaultModelId,
    ...(!!negativePrompt && { negativePrompt }),
    ...(!!steps && { steps }),
    ...(!!cfgScale && { cfgScale }),
    ...(!!seed && { seed }),
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
      if (imagineResponse.status === 'success') {
        editMessage(conversationId, assistantMessageId, { text: imagineResponse.imageUrl }, false);
        // NOTE: imagineResponse shall have an altText which contains some description we could show on mouse hover
        //       Would be hard to do it with the current plain-text URL tho - shall consider changing the workaround format
      }
    } else
      editMessage(conversationId, assistantMessageId, { text: `Sorry, I had issues requesting this image. Check your API key?` }, false);
  } catch (error: any) {
    editMessage(conversationId, assistantMessageId, { text: `Sorry, I couldn't generate an image for that. Issue: ${error}.` }, false);
  }
  editMessage(conversationId, assistantMessageId, { typing: false }, false);
};