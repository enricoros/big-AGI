import { getImageAsset } from '~/modules/dblobs/dblobs.images';

import type { DMessage } from '~/common/stores/chat/chat.message';
import { DMessageImageRefPart, isContentFragment, isContentOrAttachmentFragment, isTextPart } from '~/common/stores/chat/chat.fragments';
import { LLMImageResizeMode, resizeBase64ImageIfNeeded } from '~/common/util/imageUtils';

// NOTE: pay particular attention to the "import type", as this is importing from the server-side Zod definitions
import type { AixAPIChatGenerate_Request, AixMessages_ModelMessage, AixMessages_UserMessage, AixParts_InlineImagePart, AixParts_MetaReplyToPart } from '../server/api/aix.wiretypes';

// TODO: remove console messages to zero, or replace with throws or something


// configuration
export const MODEL_IMAGE_RESCALE_MIMETYPE = 'image/webp';
export const MODEL_IMAGE_RESCALE_QUALITY = 0.90;


//
// AIX <> Chat Messages API helpers
//

export async function aixChatGenerateRequestFromDMessages(messageSequence: Readonly<DMessage[]>): Promise<AixAPIChatGenerate_Request> {
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
          console.warn('conversationMessagesToAixGenerateRequest: unexpected system fragment', systemFragment);
        }
      }
      return acc;
    }

    // map the other parts
    if (m.role === 'user') {

      const dMEssageUserFragments = m.fragments;
      const aixChatMessageUser = await dMEssageUserFragments.reduce(async (mMsgPromise, uFragment) => {

        const uMsg = await mMsgPromise;
        if (!isContentOrAttachmentFragment(uFragment) || uFragment.part.pt === '_pt_sentinel' || uFragment.part.pt === 'ph')
          return uMsg;

        switch (uFragment.part.pt) {
          case 'text':
            uMsg.parts.push(uFragment.part);
            break;

          case 'image_ref':
            // note, we don't resize, as the user image is resized following the user's preferences
            uMsg.parts.push(await _convertImageRefToInlineImageOrThrow(uFragment.part, false));
            break;

          case 'doc':
            uMsg.parts.push(uFragment.part);
            break;

          // skipped (non-user)
          case 'error':
          case 'tool_invocation':
          case 'tool_response':
            break;

          default:
            console.warn('conversationMessagesToAixGenerateRequest: unexpected User fragment part type', (uFragment.part as any).pt);
        }
        return uMsg;
      }, Promise.resolve({ role: 'user', parts: [] } as AixMessages_UserMessage));

      // handle reply-to metadata, adding a part right after the user text (or at the beginning)
      if (m.metadata?.inReplyToText) {
        // find the index of the tast text part
        const lastTextPartIndex = aixChatMessageUser.parts.findLastIndex(p => p.pt === 'text');
        // insert the meta part after the last text part (and before the first attachment)
        aixChatMessageUser.parts.splice(lastTextPartIndex + 1, 0, _clientCreateAixMetaReplyToPart(m.metadata.inReplyToText));
      }

      acc.chatSequence.push(aixChatMessageUser);

    } else if (m.role === 'assistant') {

      const dMessageAssistantFragments = m.fragments;
      const aixChatMessageModel = await dMessageAssistantFragments.reduce(async (mMsgPromise, aFragment) => {

        const mMsg = await mMsgPromise;
        if (!isContentOrAttachmentFragment(aFragment) || aFragment.part.pt === '_pt_sentinel' || aFragment.part.pt === 'ph')
          return mMsg;

        switch (aFragment.part.pt) {

          case 'text':
          case 'tool_invocation':
            // Key place where the Aix Zod inferred types are compared to the Typescript defined DMessagePart* types
            // - in case of error, check that the types in `chat.fragments.ts` and `aix.wiretypes.ts` are in sync
            mMsg.parts.push(aFragment.part);
            break;

          case 'doc':
            // TODO
            console.warn('conversationMessagesToAixGenerateRequest: doc part not implemented yet');
            // mMsg.parts.push(aFragment.part);
            break;

          case 'error':
            mMsg.parts.push({ pt: 'text', text: `[ERROR] ${aFragment.part.error}` });
            break;

          case 'image_ref':
            // TODO: rescale shall be dependent on the LLM here - and be careful with the high-res options, as they can
            //  be really space consuming. how to choose between high and low? global option?
            const resizeMode: LLMImageResizeMode = 'openai-low-res';
            mMsg.parts.push(await _convertImageRefToInlineImageOrThrow(aFragment.part, resizeMode));
            break;

          case 'tool_response':
            // TODO
            console.warn('conversationMessagesToAixGenerateRequest: tool_response part not implemented yet');
            break;

        }
        return mMsg;
      }, Promise.resolve({ role: 'model', parts: [] } as AixMessages_ModelMessage));

      acc.chatSequence.push(aixChatMessageModel);

    } else {
      // TODO: impement mid-chat system messages?
      console.warn('historyToChatGenerateRequest: unexpected message role', m.role);
    }

    return acc;
  }, Promise.resolve({ chatSequence: [] } as AixAPIChatGenerate_Request));
}


/// Parts that differ from DMessage*Part to AIX

async function _convertImageRefToInlineImageOrThrow(imageRefPart: DMessageImageRefPart, resizeMode: LLMImageResizeMode | false): Promise<AixParts_InlineImagePart> {

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

  return _clientCreateAixInlineImagePart(base64Data, mimeType || dataRef.mimeType);
}

function _clientCreateAixInlineImagePart(base64: string, mimeType: string): AixParts_InlineImagePart {
  return { pt: 'inline_image', mimeType: (mimeType || 'image/png') as AixParts_InlineImagePart['mimeType'], base64 };
}

function _clientCreateAixMetaReplyToPart(replyTo: string): AixParts_MetaReplyToPart {
  return { pt: 'meta_reply_to', replyTo };
}
