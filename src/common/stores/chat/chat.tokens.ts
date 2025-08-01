import { getChatTokenCountingMethod } from '../../../apps/chat/store-app-chat';

import type { DLLM } from '~/common/stores/llms/llms.types';
import { approximateTextTokens } from '~/common/tokens/tokens.approximate';
import { imageTokensForLLM } from '~/common/tokens/tokens.image';
import { textTokensForLLM } from '~/common/tokens/tokens.text';

import type { DMessageRole } from './chat.message';
import { DMessageAttachmentFragment, DMessageFragment, isAttachmentFragment, isContentFragment, isContentOrAttachmentFragment, isDocPart, isVoidFragment } from './chat.fragments';


export function estimateTokensForFragments(llm: DLLM, role: DMessageRole, fragments: DMessageFragment[], addTopGlue: boolean, debugFrom: string) {
  return fragments.reduce((acc, fragment) => {
    let fragmentTokens = _fragmentTokens(llm, role, fragment, debugFrom);
    if (acc > 0 || addTopGlue)
      fragmentTokens += _glueForFragmentTokens(llm);
    return acc + fragmentTokens;
  }, 0);
}


// Text

export function estimateTextTokens(text: string, llm: DLLM, debugFrom: string): number {
  // Approximate path
  if (getChatTokenCountingMethod() === 'approximate')
    return approximateTextTokens(text, llm, debugFrom);

  // Default to accurate method (the JS+WASM 'tiktoken' lib)
  const accurateTokens = textTokensForLLM(text, llm, debugFrom);
  if (accurateTokens !== null)
    return accurateTokens;

  // Fallback to approximate if the accurate method is not available
  return approximateTextTokens(text, llm, debugFrom);
}

function estimateImageTokens(width: number | undefined, height: number | undefined, debugTitle: string | undefined, llm: DLLM): number {
  return imageTokensForLLM(width, height, debugTitle, llm);
}


// Content Parts

function _fragmentTokens(llm: DLLM, role: DMessageRole, fragment: DMessageFragment, debugFrom: string): number {
  // non content/attachment fragments are ignored
  if (!isContentOrAttachmentFragment(fragment) || fragment.part.pt === '_pt_sentinel')
    return 0;

  // attachment fragments
  if (isAttachmentFragment(fragment)) {
    const aPart = fragment.part;
    const aPt = aPart.pt;
    switch (aPt) {
      case 'doc':
        const likelyRendition = marshallWrapText(aPart.data.text, aPart.ref, 'markdown-code');
        return estimateTextTokens(likelyRendition, llm, debugFrom);
      case 'reference':
        // "fallback" to inline computation for Asset Reference fragments with legacy image refs
        if (aPart.rt === 'zync' && aPart.assetType === 'image' && aPart._legacyImageRefPart?.dataRef?.reftype === 'dblob') {
          const forcedSize = role === 'assistant' ? 512 : undefined;
          return estimateImageTokens(forcedSize || aPart._legacyImageRefPart.width, forcedSize || aPart._legacyImageRefPart.height, fragment.title, llm);
        }
        // TODO: implement this properly - as we don't have resolutions in the part(!) - and this could be really expensive
        break; // warn
      case 'image_ref':
        // NOTE: should not happen with attachments, unless someone '/a' a message with an image attached
        const forcedSize = role === 'assistant' ? 512 : undefined;
        return estimateImageTokens(forcedSize || aPart.width, forcedSize || aPart.height, fragment.title, llm);
      default:
        const _exhaustiveCheck: never = aPt;
    }
  } else if (isContentFragment(fragment)) {
    const cPart = fragment.part;
    const cPt = cPart.pt;
    switch (cPt) {
      case 'error':
        return estimateTextTokens(cPart.error, llm, debugFrom);
      case 'reference':
        // "fallback" to inline computation for Asset Reference fragments with legacy image refs
        if (cPart.rt === 'zync' && cPart.assetType === 'image' && cPart._legacyImageRefPart?.dataRef?.reftype === 'dblob') {
          const forcedSize = role === 'assistant' ? 512 : undefined;
          return estimateImageTokens(forcedSize || cPart._legacyImageRefPart.width, forcedSize || cPart._legacyImageRefPart.height, debugFrom, llm);
        }
        // TODO: implement this properly - as we don't have resolutions in the part(!) - and this could be really expensive
        break; // warn
      case 'image_ref':
        const forcedSize = role === 'assistant' ? 512 : undefined;
        return estimateImageTokens(forcedSize || cPart.width, forcedSize || cPart.height, debugFrom, llm);
      case 'text':
        return estimateTextTokens(cPart.text, llm, debugFrom);
      case 'tool_invocation':
      case 'tool_response':
        break; // warn
      default:
        const _exhaustiveCheck: never = cPt;
    }
  } else if (isVoidFragment(fragment)) {
    // all void fragments are ignored by definition and never sent to the llm
    // NOTE: make sure you collapse/don't account for the containing message as well, if left empty
    return 0;
  }
  console.warn(`[DEV] Unhandled token preview for fragment/part: ${fragment.ft}/${fragment.part?.pt}`);
  return 0;
}


// Attachment Fragments

export type TextAttachmentWrapFormat = false | 'markdown-code';

/**
 * API Note: you should not use this function much, as it lowers the grade of higher level information
 */
export function marshallWrapText(text: string, blockTitle: string | undefined, wrapFormat: TextAttachmentWrapFormat): string {
  if (wrapFormat === 'markdown-code')
    return `\`\`\`${blockTitle || ''}\n${text}\n\`\`\``;
  return text;
}

/**
 * API Note: you should not use this function much, as it lowers the grade of higher level information
 */
export function marshallWrapDocFragments(initialText: string | null, fragments: (/*DMessageContentFragment |*/ DMessageAttachmentFragment)[], wrapFormat: TextAttachmentWrapFormat, separator: string): string {
  let inlinedText = initialText || '';
  for (const fragment of fragments) {
    // warn on non-text fragments, which are not handled - it's an API error to call this function to non-text-part fragments
    if (!isDocPart(fragment.part)) {
      console.warn('marshallWrapTextFragments: unhandled part type:', fragment.part.pt);
      continue;
    }

    if (inlinedText.length)
      inlinedText += separator;

    const docPart = fragment.part;
    inlinedText += marshallWrapText(docPart.data.text, docPart.ref, wrapFormat);
  }
  return inlinedText;
}


// Encoding Glue - TODO: implement these correctly and based off LLMs

function _glueForFragmentTokens(_llm: DLLM): number {
  return 4;
}

export function glueForMessageTokens(_llm: DLLM): number {
  return 4;
}