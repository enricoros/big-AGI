import { getImageAsset } from '~/modules/dblobs/dblobs.images';

import { DMessage, DMetaReferenceItem, MESSAGE_FLAG_AIX_SKIP, MESSAGE_FLAG_VND_ANT_CACHE_AUTO, MESSAGE_FLAG_VND_ANT_CACHE_USER, messageHasUserFlag } from '~/common/stores/chat/chat.message';
import { DMessageImageRefPart, isContentFragment, isContentOrAttachmentFragment, isTextPart } from '~/common/stores/chat/chat.fragments';
import { Is } from '~/common/util/pwaUtils';
import { LLMImageResizeMode, resizeBase64ImageIfNeeded } from '~/common/util/imageUtils';

// NOTE: pay particular attention to the "import type", as this is importing from the server-side Zod definitions
import type { AixAPIChatGenerate_Request, AixMessages_ChatMessage, AixMessages_ModelMessage, AixMessages_UserMessage, AixParts_InlineImagePart, AixParts_MetaCacheControl, AixParts_MetaInReferenceToPart } from '../server/api/aix.wiretypes';

// TODO: remove console messages to zero, or replace with throws or something


// configuration
const MODEL_IMAGE_RESCALE_MIMETYPE = !Is.Browser.Safari ? 'image/webp' : 'image/jpeg';
const MODEL_IMAGE_RESCALE_QUALITY = 0.90;


// AIX <> Simple Text API helpers

/**
 * The simplest text-only inputs for aixChatGenerateContent_DMessage.
 */
export type AixChatGenerate_TextMessages = {
  role: AixMessages_ChatMessage['role'];
  text: string;
}[];

export function aixCGR_FromSimpleText(systemInstruction: string, messages: AixChatGenerate_TextMessages): AixAPIChatGenerate_Request {
  return {
    systemMessage: aixCGR_SystemMessage(systemInstruction),
    chatSequence: messages.map(m => {
      switch (m.role) {
        case 'user':
          return aixCGR_UserMessageText(m.text);
        case 'model':
        case 'tool':
          return aixCGR_ModelMessageText(m.text);
      }
    }),
  };
}

export function aixCGR_SystemMessage(text: string) {
  return { parts: [aixCGRTextPart(text)] };
}

export function aixCGR_UserMessageText(text: string): AixMessages_UserMessage {
  return { role: 'user', parts: [aixCGRTextPart(text)] };
}

function aixCGR_ModelMessageText(text: string): AixMessages_ModelMessage {
  return { role: 'model', parts: [aixCGRTextPart(text)] };
}

function aixCGRTextPart(text: string) {
  return { pt: 'text' as const, text };
}


//
// AIX <> Chat Messages API helpers
//

export async function aixCGR_FromDMessages(
  messageSequence: Readonly<Pick<DMessage, 'role' | 'fragments' | 'metadata' | 'userFlags'>[]>, // Note: adding the "Pick" to show the low requirement from the DMessage type, as we'll move to simpler APIs soon
  _assemblyMode: 'complete' = 'complete',
): Promise<AixAPIChatGenerate_Request> {

  // if the user has marked messages for exclusion, we skip them
  messageSequence = messageSequence.filter(m => !messageHasUserFlag(m, MESSAGE_FLAG_AIX_SKIP));

  // reduce history
  return await messageSequence.reduce(async (accPromise, m, index): Promise<AixAPIChatGenerate_Request> => {
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
          console.warn('aixChatGenerateRequestFromDMessages: unexpected system fragment', systemFragment);
        }
      }
      // (on System message) handle the ant-cache-prompt user/auto flags
      if (messageHasUserFlag(m, MESSAGE_FLAG_VND_ANT_CACHE_AUTO) || messageHasUserFlag(m, MESSAGE_FLAG_VND_ANT_CACHE_USER))
        acc.systemMessage.parts.push(_clientCreateAixMetaCacheControlPart('anthropic-ephemeral'));
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
            console.warn('aixChatGenerateRequestFromDMessages: unexpected User fragment part type', (uFragment.part as any).pt);
        }
        return uMsg;
      }, Promise.resolve({ role: 'user', parts: [] } as AixMessages_UserMessage));

      // handle in-reference-to metadata, adding a part right after the user text (or at the beginning)
      if (m.metadata?.inReferenceTo?.length) {
        // find the index of the tast text part
        const lastTextPartIndex = aixChatMessageUser.parts.findLastIndex(p => p.pt === 'text');
        // insert the meta part after the last text part (and before the first attachment)
        aixChatMessageUser.parts.splice(lastTextPartIndex + 1, 0, _clientCreateAixMetaInReferenceToPart(m.metadata.inReferenceTo));
      }

      // (on User messages) handle the ant-cache-prompt user/auto flags
      if (messageHasUserFlag(m, MESSAGE_FLAG_VND_ANT_CACHE_AUTO) || messageHasUserFlag(m, MESSAGE_FLAG_VND_ANT_CACHE_USER))
        aixChatMessageUser.parts.push(_clientCreateAixMetaCacheControlPart('anthropic-ephemeral'));

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
            console.warn('aixChatGenerateRequestFromDMessages: doc part not implemented yet');
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
            console.warn('aixChatGenerateRequestFromDMessages: tool_response part not implemented yet');
            break;

        }
        return mMsg;
      }, Promise.resolve({ role: 'model', parts: [] } as AixMessages_ModelMessage));

      // (on Assistant messages) handle the ant-cache-prompt user/auto flags
      if (messageHasUserFlag(m, MESSAGE_FLAG_VND_ANT_CACHE_AUTO) || messageHasUserFlag(m, MESSAGE_FLAG_VND_ANT_CACHE_USER))
        aixChatMessageModel.parts.push(_clientCreateAixMetaCacheControlPart('anthropic-ephemeral'));

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

function _clientCreateAixMetaCacheControlPart(control: AixParts_MetaCacheControl['control']): AixParts_MetaCacheControl {
  return { pt: 'meta_cache_control', control: control };
}

function _clientCreateAixMetaInReferenceToPart(items: DMetaReferenceItem[]): AixParts_MetaInReferenceToPart {
  return { pt: 'meta_in_reference_to', referTo: items };
}


/// Client-side hotfixes

/**
 * Hot fix for handling system messages with OpenAI O1 Preview models.
 * Converts System to User messages for compatibility.
 */
export function clientHotFixGenerateRequestForO1Preview(aixChatGenerate: AixAPIChatGenerate_Request): void {

  let workaroundsCount = 0;

  // Convert the main system message if it exists
  if (aixChatGenerate.systemMessage) {
    workaroundsCount++;

    // Convert system message to user message
    const systemAsUser: AixMessages_UserMessage = {
      role: 'user',
      parts: aixChatGenerate.systemMessage.parts,
    };

    // Insert the converted system message at the beginning of the chat sequence
    aixChatGenerate.chatSequence.unshift(systemAsUser);

    // Remove the original system message
    delete aixChatGenerate.systemMessage;
  }

  // Note: other conversions that would translate to system inside the AIX Dispatch will be handled there, as we have a
  // higher level representation here, where the roles are 'user', 'model', and 'tool'.

  // Remove any inline images from the entire chat sequence
  for (let i = 0; i < aixChatGenerate.chatSequence.length; i++) {
    const message = aixChatGenerate.chatSequence[i];

    // Iterate over message parts and remove inline images
    for (let j = message.parts.length - 1; j >= 0; j--) {
      if (message.parts[j].pt === 'inline_image') {
        workaroundsCount++;
        message.parts.splice(j, 1);
      }
    }
  }

  // Log the number of workarounds applied
  if (workaroundsCount > 0)
    console.warn(`[DEV] Working around o1 models limitations: applied ${workaroundsCount} client-side workarounds`);

}