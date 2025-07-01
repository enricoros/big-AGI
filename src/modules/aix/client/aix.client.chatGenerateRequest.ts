import { getImageAsset } from '~/common/stores/blob/dblobs-portability';

import { DLLM, LLM_IF_HOTFIX_NoStream, LLM_IF_HOTFIX_StripImages, LLM_IF_HOTFIX_StripSys0, LLM_IF_HOTFIX_Sys0ToUsr0 } from '~/common/stores/llms/llms.types';
import { DMessage, DMessageRole, DMetaReferenceItem, MESSAGE_FLAG_AIX_SKIP, MESSAGE_FLAG_VND_ANT_CACHE_AUTO, MESSAGE_FLAG_VND_ANT_CACHE_USER, messageHasUserFlag } from '~/common/stores/chat/chat.message';
import { DMessageFragment, DMessageImageRefPart, isAttachmentFragment, isContentOrAttachmentFragment, isDocPart, isTextContentFragment, isToolResponseFunctionCallPart, isVoidThinkingFragment } from '~/common/stores/chat/chat.fragments';
import { Is } from '~/common/util/pwaUtils';
import { convert_Base64WithMimeType_To_Blob, convert_Blob_To_Base64 } from '~/common/util/blobUtils';
import { imageBlobResizeIfNeeded, LLMImageResizeMode } from '~/common/util/imageUtils';

// NOTE: pay particular attention to the "import type", as this is importing from the server-side Zod definitions
import type { AixAPIChatGenerate_Request, AixMessages_ModelMessage, AixMessages_ToolMessage, AixMessages_UserMessage, AixParts_InlineImagePart, AixParts_MetaCacheControl, AixParts_MetaInReferenceToPart, AixParts_ModelAuxPart } from '../server/api/aix.wiretypes';

// TODO: remove console messages to zero, or replace with throws or something


// configuration
const MODEL_IMAGE_RESCALE_MIMETYPE = !Is.Browser.Safari ? 'image/webp' : 'image/jpeg';
const MODEL_IMAGE_RESCALE_QUALITY = 0.90;
const IGNORE_CGR_NO_IMAGE_DEREFERENCE = true; // set to false to raise an exception, otherwise the CGR will continue skipping the part


// AIX <> Simple Text API helpers

/**
 * The simplest text-only inputs for aixChatGenerateContent_DMessage.
 */
export type AixChatGenerate_TextMessages = {
  role: 'user' | 'model';
  text: string;
}[];

export function aixCGR_FromSimpleText(systemInstruction: null | string, messages: AixChatGenerate_TextMessages): AixAPIChatGenerate_Request {
  return {
    systemMessage: systemInstruction === null ? null : aixCGR_SystemMessageText(systemInstruction),
    chatSequence: messages.map(m => {
      switch (m.role) {
        case 'user':
          return aixCGR_UserMessageText(m.text);
        case 'model':
          return aixCGR_ModelMessageText(m.text);
      }
    }),
  };
}

export function aixCGR_SystemMessageText(text: string) {
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


export async function aixCGR_SystemMessage_FromDMessageOrThrow(
  systemInstruction: null | Pick<DMessage, 'fragments' | 'metadata' | 'userFlags'>,
): Promise<AixAPIChatGenerate_Request['systemMessage']> {

  // quick bypass for no message
  if (!systemInstruction)
    return null;

  // create the system instruction
  const sm: AixAPIChatGenerate_Request['systemMessage'] = {
    parts: [],
  };

  // process fragments of the system instruction
  for (const fragment of systemInstruction.fragments) {
    if (isTextContentFragment(fragment)) {
      sm.parts.push(fragment.part);
    } else if (isAttachmentFragment(fragment) && isDocPart(fragment.part)) {
      sm.parts.push(fragment.part);
    } else {
      if (process.env.NODE_ENV === 'development')
        throw new Error('[DEV] aixCGR_systemMessageFromInstruction: unexpected system fragment');
      console.warn('[DEV] aixCGR_systemMessageFromInstruction: unexpected system fragment:', fragment);
    }
  }

  // (on System message) handle the ant-cache-prompt user/auto flags
  const mHasAntCacheFlag = messageHasUserFlag(systemInstruction, MESSAGE_FLAG_VND_ANT_CACHE_AUTO) || messageHasUserFlag(systemInstruction, MESSAGE_FLAG_VND_ANT_CACHE_USER);
  if (mHasAntCacheFlag
    && sm.parts.length > 0 // added this to avoid settings a cache control on an empty system message
  )
    sm.parts.push(_clientCreateAixMetaCacheControlPart('anthropic-ephemeral'));

  return sm;
}


export async function aixCGR_ChatSequence_FromDMessagesOrThrow(
  messageSequenceWithoutSystem: Readonly<Pick<DMessage, 'role' | 'fragments' | 'metadata' | 'userFlags'>[]>, // Note: adding the "Pick" to show the low requirement from the DMessage type, as we'll move to simpler APIs soon
  // _assemblyMode: 'complete' = 'complete',
): Promise<AixAPIChatGenerate_Request['chatSequence']> {

  // if the user has marked messages for exclusion, we skip them
  messageSequenceWithoutSystem = messageSequenceWithoutSystem.filter(m => !messageHasUserFlag(m, MESSAGE_FLAG_AIX_SKIP));

  const lastAssistantMessageIndex = messageSequenceWithoutSystem.findLastIndex(m => m.role === 'assistant');

  // reduce history
  // NOTE: we used to have a "systemMessage" here, but we're moving to a more strict API with separate processing of it;
  //       - as such we now 'throw' if a system message is found (on dev mode, and just warn in production).
  //       - still, we keep the full reducer as a 'AixCGR_FromDmessages' type, in case we need more complex reductions in the future
  const cgr = await messageSequenceWithoutSystem.reduce(async (accPromise, m, _index): Promise<AixAPIChatGenerate_Request> => {
    const acc = await accPromise;

    // (on any User/Assistant messages) check the ant-cache-prompt user/auto flags
    const mHasAntCacheFlag = messageHasUserFlag(m, MESSAGE_FLAG_VND_ANT_CACHE_AUTO) || messageHasUserFlag(m, MESSAGE_FLAG_VND_ANT_CACHE_USER);

    // in the new version we handle all parts and only expect User and Assistant DMessages - as the System has been handled separately
    const dMessageRole: DMessageRole = m.role;
    if (dMessageRole === 'user') {

      const dMessageUserFragments = m.fragments;
      const aixChatMessageUser = await dMessageUserFragments.reduce(async (uMsgPromise, uFragment: DMessageFragment) => {

        const uMsg = await uMsgPromise;
        if (!isContentOrAttachmentFragment(uFragment) || uFragment.part.pt === '_pt_sentinel')
          return uMsg;

        switch (uFragment.part.pt) {
          case 'text':
            uMsg.parts.push(uFragment.part);
            break;

          case 'image_ref':
            // note, we don't resize, as the user image is resized following the user's preferences
            try {
              uMsg.parts.push(await aixConvertImageRefToInlineImageOrThrow(uFragment.part, false));
            } catch (error: any) {
              if (IGNORE_CGR_NO_IMAGE_DEREFERENCE) console.warn(`Image from the user missing in the chat generation request because: ${error?.message || error?.toString() || 'Unknown error'} - continuing without`);
              else throw error;
            }
            break;

          case 'doc':
            uMsg.parts.push(uFragment.part);
            break;

          // skipped (non-user)
          case 'error':
          case 'tool_invocation':
          case 'tool_response':
            console.warn('aixCGR_FromDMessages: unexpected Non-User fragment part type', (uFragment.part as any).pt);
            break;

          default:
            const _exhaustiveCheck: never = uFragment.part;
            console.warn('aixCGR_FromDMessages: unexpected User fragment part type', (uFragment.part as any).pt);
        }
        return uMsg;
      }, Promise.resolve({ role: 'user', parts: [] } as AixMessages_UserMessage));

      // handle in-reference-to metadata, adding a part right after the user text (or at the beginning)
      if (m.metadata?.inReferenceTo?.length) {
        // find the index of the last text part
        const lastTextPartIndex = aixChatMessageUser.parts.findLastIndex(p => p.pt === 'text');
        // insert the meta part after the last text part (and before the first attachment)
        aixChatMessageUser.parts.splice(lastTextPartIndex + 1, 0, _clientCreateAixMetaInReferenceToPart(m.metadata.inReferenceTo));
      }

      // (on User messages) handle the ant-cache-prompt user/auto flags
      if (mHasAntCacheFlag)
        aixChatMessageUser.parts.push(_clientCreateAixMetaCacheControlPart('anthropic-ephemeral'));

      acc.chatSequence.push(aixChatMessageUser);

    } else if (dMessageRole === 'assistant') {

      // Note: even tool invocations and responses were interleaved, we will bucket them in 1 model message and 1 tool message
      // FIXME: assumption that this is the right way of handling it, rather than interleaving many messages
      const modelMessage: AixMessages_ModelMessage = { role: 'model', parts: [] };
      const toolMessage: AixMessages_ToolMessage = { role: 'tool', parts: [] };

      for (const aFragment of m.fragments) {

        if ((!isContentOrAttachmentFragment(aFragment) && !isVoidThinkingFragment(aFragment)) || aFragment.part.pt === '_pt_sentinel')
          continue;

        switch (aFragment.part.pt) {

          case 'text':
          case 'tool_invocation':
            // Key place where the Aix Zod inferred types are compared to the Typescript defined DMessagePart* types
            // - in case of error, check that the types in `chat.fragments.ts` and `aix.wiretypes.ts` are in sync
            modelMessage.parts.push(aFragment.part);
            break;

          case 'ma':
            // https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking#why-thinking-blocks-must-be-preserved
            // [Anthropic] special case: despite being Void, we send the DVoidModelAuxPart which has signed Thinking blocks and Redacted data,
            //             which may be instrumental for the model to execute tools-result follow-up actions/text.
            const isAntModelAux = aFragment.part.textSignature || aFragment.part.redactedData?.length;
            if (isAntModelAux)
              modelMessage.parts.push(aFragment.part as AixParts_ModelAuxPart /* NOTE: this is a forced cast from readonly string[] to string[], but not a big deal here*/);
            break;

          case 'doc':
            // TODO
            console.warn('aixCGR_FromDMessages: doc part from Assistant not implemented yet');
            // mMsg.parts.push(aFragment.part);
            break;

          case 'error':
            // Note: the llm will receive the extra '[ERROR]' text; this could be optimized to handle errors better
            modelMessage.parts.push({ pt: 'text', text: `[ERROR] ${aFragment.part.error}` });
            break;

          case 'image_ref':
            // TODO: rescale shall be dependent on the LLM here - and be careful with the high-res options, as they can
            //  be really space consuming. how to choose between high and low? global option?
            /**
             * FIXME for GEMINI IMAGE GENERATION
             * For now we upload ONLY THE LAST IMAGE as full quality, while all others are resized before transmission.
             */
            const isLastAssistantMessage = _index === lastAssistantMessageIndex;
            const resizeMode = isLastAssistantMessage ? false : 'openai-low-res';
            try {
              modelMessage.parts.push(await aixConvertImageRefToInlineImageOrThrow(aFragment.part, resizeMode));
            } catch (error: any) {
              if (IGNORE_CGR_NO_IMAGE_DEREFERENCE) console.warn(`Image from the assistant missing in the chat generation request because: ${error?.message || error?.toString() || 'Unknown error'} - continuing without`);
              else throw error;
            }
            break;

          case 'tool_response':
            // Valiation of DMessageToolResponsePart of response.type: 'function_call'
            // - NOTE: for now we make the large assumption that responses are JSON objects, not arrays, not strings
            // - This was done for Gemini as the response needs to be an object; however we will need to decide:
            // TODO: decide the responses policy: do we allow only objects? if not, then what's the rule to convert objects to Gemini's inputs?
            if (isToolResponseFunctionCallPart(aFragment.part)) {
              let resultObject: any;
              try {
                resultObject = JSON.parse(aFragment.part.response.result);
              } catch (error: any) {
                throw new Error('[AIX validation] expecting `tool_response` to be parseable');
              }
              if (!resultObject || typeof resultObject !== 'object')
                throw new Error('[AIX validation] expecting `tool_response` to be a JSON object');
              if (Array.isArray(resultObject))
                throw new Error('[AIX validation for Gemini] expecting `tool_response` to not be an array');
            }
            toolMessage.parts.push(aFragment.part);
            break;

          default:
            const _exhaustiveCheck: never = aFragment.part;
            console.warn('aixCGR_FromDMessages: unexpected Assistant fragment part', aFragment.part);
            break;
        }
      }

      const assistantMessages: (AixMessages_ModelMessage | AixMessages_ToolMessage)[] = [];
      if (modelMessage.parts.length > 0)
        assistantMessages.push(modelMessage);
      if (toolMessage.parts.length > 0)
        assistantMessages.push(toolMessage);

      // (on Assistant messages) handle the ant-cache-prompt user/auto flags, on the very last message
      if (mHasAntCacheFlag && assistantMessages.length > 0)
        assistantMessages[assistantMessages.length - 1].parts.push(_clientCreateAixMetaCacheControlPart('anthropic-ephemeral'));

      // Add the assistant messages to the chatSequence
      acc.chatSequence.push(...assistantMessages);

    } else {

      // DEV MODE: THROW ERROR, to aid the porting efforts
      if (process.env.NODE_ENV === 'development')
        throw new Error(`[DEV] aixCGR_FromDMessages: unexpected message role ${m.role}. Please PORT the caller to the systemIntruction API change.`);

      // TODO: implement mid-chat system messages if needed
      // NOTE: the API should just disallow 'system' messages in the middle of the chat
      console.warn('[DEV] aixCGR_FromDMessages: unexpected message role', m.role);

    }

    return acc;
  }, Promise.resolve({
    systemMessage: null,
    chatSequence: [],
  } as Pick<AixAPIChatGenerate_Request, 'systemMessage' | 'chatSequence'>) /* this is the key to the new version of this function which doesn't extract system messages anymore */);

  // as promised we only return this as we only built this, and not the full CGR.
  return cgr.chatSequence;
}


/// Parts that differ from DMessage*Part to AIX

export async function aixConvertImageRefToInlineImageOrThrow(imageRefPart: DMessageImageRefPart, resizeMode: LLMImageResizeMode | false): Promise<AixParts_InlineImagePart> {

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

  // base64 -> blob conversion
  let { mimeType, base64: base64Data } = imageAsset.data;

  // convert if requested (with intermediate Blob transformation)
  if (resizeMode) {
    try {
      // convert base64 -> Blob
      const imageBlob = await convert_Base64WithMimeType_To_Blob(base64Data, mimeType, 'aixConvertImageRefToInlineImage');
      // resize Blob
      const resizedOp = await imageBlobResizeIfNeeded(imageBlob, resizeMode, MODEL_IMAGE_RESCALE_MIMETYPE, MODEL_IMAGE_RESCALE_QUALITY);
      if (resizedOp) {
        // if resized, convert resized Blob back to base64
        base64Data = await convert_Blob_To_Base64(resizedOp.blob, 'aixConvertImageRefToInlineImage');
        mimeType = resizedOp.blob.type as any;
      }
    } catch (resizeError) {
      console.warn('[DEV] aixConvertImageRefToInlineImageOrThrow: Error resizing image:', resizeError);
      // continue without resizing, as this is not critical
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


export function clientHotFixGenerateRequest_ApplyAll(llmInterfaces: DLLM['interfaces'], aixChatGenerate: AixAPIChatGenerate_Request, modelName: string): {
  shallDisableStreaming: boolean;
  workaroundsCount: number;
} {

  let workaroundsCount = 0;

  // Apply the remove-sys0 hot fix - at the time of doing it, Gemini Image Generation does not use the system instructions
  if (llmInterfaces.includes(LLM_IF_HOTFIX_StripSys0))
    workaroundsCount += clientHotFixGenerateRequest_StripSys0(aixChatGenerate);

  // Apply the cast-sys0-to-usr0 hot fix (e.g. o1-preview); however this is a late-stage emergency hotfix as we expect the caller to be aware of this logic
  if (llmInterfaces.includes(LLM_IF_HOTFIX_Sys0ToUsr0))
    workaroundsCount += clientHotFixGenerateRequest_Sys0ToUsr0(aixChatGenerate);

  // Apply the strip-images hot fix (e.g. o1-preview); however this is a late-stage emergency hotfix as we expect the caller to be aware of this logic
  if (llmInterfaces.includes(LLM_IF_HOTFIX_StripImages))
    workaroundsCount += clientHotFixGenerateRequest_StripImages(aixChatGenerate);

  // Disable streaming for select chat models that don't support it (e.g. o1-preview (old) and o1-2024-12-17)
  const shallDisableStreaming = llmInterfaces.includes(LLM_IF_HOTFIX_NoStream);

  if (workaroundsCount > 0)
    console.warn(`[DEV] Working around '${modelName}' model limitations: client-side applied ${workaroundsCount} workarounds`);

  return { shallDisableStreaming, workaroundsCount };

}


/**
 * Hot fix for models that don't support vision input and we need to perform the fix ahead of AIX send.
 *
 * Notes for the o1-2024-12-17 model:
 * - we don't strip inline images, as o1 supports them
 */
function clientHotFixGenerateRequest_StripImages(aixChatGenerate: AixAPIChatGenerate_Request): number {

  let workaroundsCount = 0;

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
  return workaroundsCount;

}

/**
 * Hot fix for models that don't want the system message - e.g. Gemini Image Generation (although this may change)
 */
function clientHotFixGenerateRequest_StripSys0(aixChatGenerate: AixAPIChatGenerate_Request): number {

  const workaroundsCount = aixChatGenerate.systemMessage?.parts?.length ? 1 : 0;
  aixChatGenerate.systemMessage = null;
  return workaroundsCount;

}


/**
 * Hot fix for handling system messages in models that do not support them, such as `o1-preview`.
 * -> Converts System to User messages for compatibility.
 *
 * Notes for the o1-2024-12-17 model:
 * - we don't cast the system to user, as the aix dispatcher is casting the 'system' message to 'developer'
 */
function clientHotFixGenerateRequest_Sys0ToUsr0(aixChatGenerate: AixAPIChatGenerate_Request): number {

  // Convert the main system message if it exists
  if (!aixChatGenerate.systemMessage)
    return 0;

  // Convert system message to user message
  const systemAsUser: AixMessages_UserMessage = {
    role: 'user',
    parts: aixChatGenerate.systemMessage.parts,
  };

  // Insert the converted system message at the beginning of the chat sequence (recreating the array to not alter the original)
  aixChatGenerate.chatSequence = [...aixChatGenerate.chatSequence];
  aixChatGenerate.chatSequence.unshift(systemAsUser);

  // Remove the original system message
  aixChatGenerate.systemMessage = null;

  // Log the workaround applied
  return 1;

}