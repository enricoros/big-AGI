import { apiAsync } from '~/modules/trpc/trpc.client';
import { prodiaDefaultModelId } from '~/modules/prodia/prodia.models';
import { useProdiaStore } from '~/modules/prodia/store-prodia';

import { useChatStore } from '~/common/state/store-chats';

import { createAssistantTypingMessage } from './editors';


/**
 * The main 'image generation' function - for now specialized to the 'imagine' command.
 */
export async function runImageGenerationUpdatingState(conversationId: string, imageText: string) {

  // create a blank and 'typing' message for the assistant
  const assistantMessageId = createAssistantTypingMessage(conversationId, 'prodia', undefined,
    `Give me a few seconds while I draw ${imageText?.length > 20 ? 'that' : '"' + imageText + '"'}...`);

  // reference the state editing functions
  const { editMessage } = useChatStore.getState();

  try {

    const { prodiaApiKey: prodiaKey, prodiaModelId, prodiaNegativePrompt: negativePrompt, prodiaSteps: steps, prodiaCfgScale: cfgScale, prodiaSeed: seed } = useProdiaStore.getState();

    const { imageUrl } = await apiAsync.prodia.imagine.query({
      ...(!!prodiaKey && { prodiaKey }),
      prodiaModel: prodiaModelId || prodiaDefaultModelId,
      prompt: imageText,
      ...(!!negativePrompt && { negativePrompt }),
      ...(!!steps && { steps }),
      ...(!!cfgScale && { cfgScale }),
      ...(!!seed && { seed }),
    });

    // NOTE: imagineResponse shall have an altText which contains some description we could show on mouse hover
    //       Would be hard to do it with the current plain-text URL tho - shall consider changing the workaround format
    editMessage(conversationId, assistantMessageId, { text: imageUrl, typing: false }, false);

  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    editMessage(conversationId, assistantMessageId, { text: `Sorry, I couldn't create an image for you. ${errorMessage}`, typing: false }, false);
  }
}