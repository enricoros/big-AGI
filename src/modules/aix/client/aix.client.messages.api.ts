import { getImageAsset } from '~/modules/dblobs/dblobs.images';

import type { DMessage } from '~/common/stores/chat/chat.message';
import { DMessageImageRefPart, isContentFragment, isContentOrAttachmentFragment, isTextPart } from '~/common/stores/chat/chat.fragments';

import { AixChatContentGenerateRequest, AixChatMessage, AixChatMessageModel, AixChatMessageUser, createAixInlineImagePart } from './aix.client.api';

// TODO: remove console messages to zero, or replace with throws or something

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
    if (m.role === 'assistant') {

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
            const assistantInlineImage = await _convertImageRefToInlineImageOrThrow(srcFragment.part);
            mMsg.parts.push(assistantInlineImage);
            break;
          default:
            console.warn('historyToChatGenerateRequest: unexpected assistant fragment part type', srcFragment.part);
            break;
        }
        return mMsg;
      }, Promise.resolve({ role: 'model', parts: [] } as AixChatMessageModel));

    } else if (m.role === 'user') {

      aixChatMessage = await m.fragments.reduce(async (mMsgPromise, srcFragment) => {
        const mMsg = await mMsgPromise;
        if (!isContentOrAttachmentFragment(srcFragment))
          return mMsg;
        switch (srcFragment.part.pt) {
          case 'text':
            mMsg.parts.push(srcFragment.part);
            break;
          case 'image_ref':
            const inlineImage = await _convertImageRefToInlineImageOrThrow(srcFragment.part);
            mMsg.parts.push(inlineImage);
            break;
          case 'doc':
            mMsg.parts.push(srcFragment.part);
            break;
          default:
            console.warn('historyToChatGenerateRequest: unexpected user fragment part type', srcFragment.part);
        }
        return mMsg;
      }, Promise.resolve({ role: 'user', parts: [] } as AixChatMessageUser));

    } else {
      // TODO: impement mid-chat system messages
      console.warn('historyToChatGenerateRequest: unexpected message role', m.role);
    }
    if (aixChatMessage)
      acc.chatSequence.push(aixChatMessage);
    return acc;
  }, Promise.resolve({ chatSequence: [] } as AixChatContentGenerateRequest));
}

async function _convertImageRefToInlineImageOrThrow(imageRefPart: DMessageImageRefPart) {
  console.log('DEV: convertImageRefToInlineImage:', imageRefPart);

  // validate
  const { dataRef } = imageRefPart;
  if (dataRef.reftype !== 'dblob' || !('dblobAssetId' in dataRef)) {
    console.warn('convertImageRefToInlineImage: unexpected data ref', dataRef);
    throw new Error('Unexpected data ref');
  }

  // get image asset
  const imageAsset = await getImageAsset(dataRef.dblobAssetId);
  if (!imageAsset) {
    console.warn('convertImageRefToInlineImage: missing image asset', dataRef);
    throw new Error('Missing image asset');
  }

  return createAixInlineImagePart(imageAsset.data.base64, dataRef.mimeType || imageAsset.data.mimeType);
}
