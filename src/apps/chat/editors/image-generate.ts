import { apiAsync } from '~/modules/trpc/trpc.client';
import { prodiaDefaultModelId } from '~/modules/prodia/prodia.models';
import { useProdiaStore } from '~/modules/prodia/store-prodia';

import { useChatStore } from '~/common/state/store-chats';

import { createAssistantTypingMessage } from './editors';


/**
 * The main 'image generation' function - for now specialized to the 'imagine' command.
 */
export async function runImageGenerationUpdatingState(conversationId: string, imageText: string) {

  // if the imageText ends with " xN" or " [N]" (where N is a number), then we'll generate N images
  const match = imageText.match(/\sx(\d+)$|\s\[(\d+)]$/);
  const count = match ? parseInt(match[1] || match[2], 10) : 1;
  if (count > 1)
    imageText = imageText.replace(/x(\d+)$|\[(\d+)]$/, '').trim(); // Remove the "xN" or "[N]" part from the imageText

  // create a blank and 'typing' message for the assistant
  const assistantMessageId = createAssistantTypingMessage(conversationId, 'prodia', undefined,
    `Give me a few seconds while I draw ${imageText?.length > 20 ? 'that' : '"' + imageText + '"'}...`);

  // reference the state editing functions
  const { editMessage } = useChatStore.getState();

  try {

    const {
      prodiaApiKey: prodiaKey, prodiaModelId,
      prodiaNegativePrompt: negativePrompt, prodiaSteps: steps, prodiaCfgScale: cfgScale,
      prodiaAspectRatio: aspectRatio, prodiaUpscale: upscale,
      prodiaSeed: seed,
    } = useProdiaStore.getState();

    // Run the image generation count times in parallel
    const imageUrls = await Promise.all(
      Array(count).fill(undefined).map(async () => {
        const { imageUrl } = await apiAsync.prodia.imagine.query({
          ...(!!prodiaKey && { prodiaKey }),
          prodiaModel: prodiaModelId || prodiaDefaultModelId,
          prompt: imageText,
          ...(!!negativePrompt && { negativePrompt }),
          ...(!!steps && { steps }),
          ...(!!cfgScale && { cfgScale }),
          ...(!!aspectRatio && aspectRatio !== 'square' && { aspectRatio }),
          ...((upscale && { upscale })),
          ...(!!seed && { seed }),
        });

        return imageUrl;
      }),
    );

    // Concatenate all the resulting URLs and update the assistant message with these URLs
    const allImageUrls = imageUrls.join('\n');
    editMessage(conversationId, assistantMessageId, { text: allImageUrls, typing: false }, false);

  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    editMessage(conversationId, assistantMessageId, { text: `Sorry, I couldn't create an image for you. ${errorMessage}`, typing: false }, false);
  }
}