import type { AixAPIChatGenerate_Request } from '~/modules/aix/server/api/aix.wiretypes';
import { aixChatGenerateContent_DMessage_orThrow, aixCreateChatGenerateContext } from '~/modules/aix/client/aix.client';

import { convert_Blob_To_Base64 } from '~/common/util/blobUtils';
import { getDomainModelIdOrThrow } from '~/common/stores/llms/store-llms';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';


/**
 * System prompt for image captioning - designed to minimize information loss
 */
const IMAGE_CAPTIONING_SYSTEM_PROMPT = `You are an expert at describing images in comprehensive detail. Your goal is to create a text description that captures as much visual information as possible, minimizing information loss for downstream AI models that will only see your text description.

Provide a detailed description covering:
1. **Overall Scene & Main Elements**: What is the primary subject? What is happening?
2. **Visual Details**: Colors, textures, patterns, materials, lighting, shadows, style (photographic, illustration, 3D render, etc.)
3. **Spatial Layout & Composition**: Positions and relationships between elements, foreground/background, arrangement
4. **Text Content**: If any text is visible, transcribe it exactly as it appears
5. **Context & Atmosphere**: Mood, setting, time of day, weather conditions (if applicable)
6. **Technical Aspects**: For UI/diagrams/charts - describe structure, labels, data, flow, connections, hierarchy

Be thorough but concise. Prioritize information that would be difficult to infer from a general description.`;


/**
 * Generate a detailed text description of an image using a vision model
 * @returns The generated caption text
 */
export async function imageCaptionFromImageOrThrow(
  imageBlob: Blob,
  imageMimeType: string,
  contextRef: string,
  abortSignal: AbortSignal,
  onProgress?: (progress: number) => void,
): Promise<string> {

  // can throw if no model
  const llmId = getDomainModelIdOrThrow(['imageCaption', 'fastUtil'], false, true, 'aifn-image-caption');

  // image -> base64
  onProgress?.(0);
  const base64Data = await convert_Blob_To_Base64(imageBlob, 'aifn-image-caption');
  onProgress?.(20);

  // create the vision request with inline image
  const visionRequest: AixAPIChatGenerate_Request = {
    systemMessage: {
      parts: [{ pt: 'text', text: IMAGE_CAPTIONING_SYSTEM_PROMPT }],
    },
    chatSequence: [{
      role: 'user',
      parts: [
        { pt: 'text', text: 'Describe this image in comprehensive detail.' },
        { pt: 'inline_image', mimeType: imageMimeType as any, base64: base64Data },
      ],
    }],
  } as const;

  // call AIX with vision model
  let lastProgress = 40;
  const result = await aixChatGenerateContent_DMessage_orThrow(
    llmId,
    visionRequest,
    aixCreateChatGenerateContext('aifn-image-caption', contextRef),
    true, // streaming
    { abortSignal },
    (update, isDone) => {
      // update progress during streaming, 40...90% with every token (so we assume at least 200 tokens)
      if (!isDone && onProgress)
        onProgress(Math.round(lastProgress = Math.min(90, lastProgress + 0.25)));
    },
  );

  // extract text from the result
  onProgress?.(100);

  // concatenate all text fragments
  const caption = messageFragmentsReduceText(result.fragments, '', false);
  if (!caption.trim())
    throw new Error('Vision model returned empty caption');

  return caption.trim();
}
