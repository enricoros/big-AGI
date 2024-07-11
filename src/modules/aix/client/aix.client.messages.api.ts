import { getImageAsset } from '~/modules/dblobs/dblobs.images';

import type { DMessage } from '~/common/stores/chat/chat.message';
import { DMessageImageRefPart, isContentFragment, isContentOrAttachmentFragment, isTextPart } from '~/common/stores/chat/chat.fragments';
import { LLMImageResizeMode, resizeBase64ImageIfNeeded } from '~/common/util/imageUtils';

import { AixChatContentGenerateRequest, AixChatMessage, AixChatMessageModel, AixChatMessageUser, createAixInlineImagePart } from './aix.client.api';


// TODO: remove console messages to zero, or replace with throws or something


// configuration
export const MODEL_IMAGE_RESCALE_MIMETYPE = 'image/webp';
export const MODEL_IMAGE_RESCALE_QUALITY = 0.90;


//
// AIX <> Chat Messages API helpers
//

export async function conversationMessagesToAixGenerateRequest(messageSequence: Readonly<DMessage[]>): Promise<AixChatContentGenerateRequest> {
  // reduce history
  return await messageSequence.reduce(async (accPromise, m, index) => {
    const acc = await accPromise;

    // extract system
    if (index === 0 && m.role === 'system') {
      // create parts if not exist
      if (!acc.systemMessage) {
        acc.systemMessage = {
          parts: [],
        };
      }
      for (const systemFragment of m.fragments) {
        if (isContentFragment(systemFragment) && isTextPart(systemFragment.part)) {
          acc.systemMessage.parts.push(systemFragment.part);
        } else {
          console.warn('historyToChatGenerateRequest: unexpected system fragment', systemFragment);
        }
      }
      return acc;
    }

    // map the other parts
    let aixChatMessage: AixChatMessage | undefined = undefined;
    if (m.role === 'user') {

      aixChatMessage = await m.fragments.reduce(async (mMsgPromise, srcFragment) => {
        const mMsg = await mMsgPromise;
        if (!isContentOrAttachmentFragment(srcFragment))
          return mMsg;
        switch (srcFragment.part.pt) {
          case 'text':
            mMsg.parts.push(srcFragment.part);
            break;
          case 'image_ref':
            // note, we don't resize, as the user image is resized following the user's preferences
            mMsg.parts.push(await _convertImageRefToInlineImageOrThrow(srcFragment.part, false));
            break;
          case 'doc':
            mMsg.parts.push(srcFragment.part);
            break;
          default:
            console.warn('historyToChatGenerateRequest: unexpected user fragment part type', srcFragment.part);
        }
        return mMsg;
      }, Promise.resolve({ role: 'user', parts: [] } as AixChatMessageUser));

    } else if (m.role === 'assistant') {

      aixChatMessage = await m.fragments.reduce(async (mMsgPromise, srcFragment) => {
        const mMsg = await mMsgPromise;
        if (!isContentOrAttachmentFragment(srcFragment))
          return mMsg;
        switch (srcFragment.part.pt) {
          case 'text':
          case 'tool_call':
            mMsg.parts.push(srcFragment.part);
            break;
          case 'image_ref':
            // TODO: rescale shall be dependent on the LLM here - and be careful with the high-res options, as they can
            //  be really space consuming. how to choose between high and low? global option?
            const resizeMode: LLMImageResizeMode = 'openai-low-res';
            mMsg.parts.push(await _convertImageRefToInlineImageOrThrow(srcFragment.part, resizeMode));
            break;
          default:
            console.warn('historyToChatGenerateRequest: unexpected assistant fragment part type', srcFragment.part);
            break;
        }
        return mMsg;
      }, Promise.resolve({ role: 'model', parts: [] } as AixChatMessageModel));

    } else {
      // TODO: impement mid-chat system messages
      console.warn('historyToChatGenerateRequest: unexpected message role', m.role);
    }
    if (aixChatMessage)
      acc.chatSequence.push(aixChatMessage);
    return acc;
  }, Promise.resolve({ chatSequence: [] } as AixChatContentGenerateRequest));
}

async function _convertImageRefToInlineImageOrThrow(imageRefPart: DMessageImageRefPart, resizeMode: LLMImageResizeMode | false) {

  // validate
  const { dataRef } = imageRefPart;
  if (dataRef.reftype !== 'dblob' || !('dblobAssetId' in dataRef)) {
    console.warn('Image reference is not supported', imageRefPart);
    throw new Error('Image reference is not supported');
  }

  // get image asset
  const imageAsset = await getImageAsset(dataRef.dblobAssetId);
  if (!imageAsset) {
    console.warn('Image asset not found', imageRefPart);
    throw new Error('Image asset not found');
  }

  // convert if requested
  let { mimeType, base64: base64Data } = imageAsset.data;
  if (resizeMode) {
    const resizedData = await resizeBase64ImageIfNeeded(mimeType, base64Data, resizeMode, MODEL_IMAGE_RESCALE_MIMETYPE, MODEL_IMAGE_RESCALE_QUALITY).catch(() => null);
    if (resizedData) {
      base64Data = resizedData.base64;
      mimeType = resizedData.mimeType as any;
    }
  }

  return createAixInlineImagePart(base64Data, mimeType || dataRef.mimeType);
}
