import type { DLLM } from '~/modules/llms/store-llms';

import { textTokensForLLM } from '~/common/tokens/tokens.text';

import { DMessageAttachmentFragment, DMessageFragment, isContentFragment, isContentOrAttachmentFragment } from '~/common/stores/chat/chat.fragments';
import { imageTokensForLLM } from '~/common/tokens/tokens.image';


export function estimateTokensForFragments(fragments: DMessageFragment[], llm: DLLM, addTopGlue: boolean, debugFrom: string) {
  return fragments.reduce((acc, fragment) => {
    let fragmentTokens = _fragmentTokens(fragment, llm, debugFrom);
    if (acc > 0 || addTopGlue)
      fragmentTokens += _glueForFragmentTokens(llm);
    return acc + fragmentTokens;
  }, 0);
}


// Text

export function estimateTextTokens(text: string, llm: DLLM, debugFrom: string): number {
  return textTokensForLLM(text, llm, debugFrom) ?? 0;
}

function estimateImageTokens(width: number | undefined, height: number | undefined, debugTitle: string | undefined, llm: DLLM): number {
  return imageTokensForLLM(width, height, debugTitle, llm);
}


// Content Parts

function _fragmentTokens(fragment: DMessageFragment, llm: DLLM, debugFrom: string): number {
  // non content/attachment fragments are ignored
  if (!isContentOrAttachmentFragment(fragment) || fragment.part.pt === '_pt_sentinel')
    return 0;

  // attachment fragments
  if (fragment.ft === 'attachment') {
    const aPart = fragment.part;
    switch (aPart.pt) {
      case 'doc':
        const likelyRendition = marshallWrapText(aPart.data.text, aPart.ref, 'markdown-code');
        return estimateTextTokens(likelyRendition, llm, debugFrom);
      case 'image_ref':
        return estimateImageTokens(aPart.width, aPart.height, fragment.title, llm);
    }
  } else if (isContentFragment(fragment)) {
    const cPart = fragment.part;
    switch (cPart.pt) {
      case 'error':
        return estimateTextTokens(cPart.error, llm, debugFrom);
      case 'image_ref':
        return estimateImageTokens(cPart.width, cPart.height, debugFrom, llm);
      case 'ph':
        return 0;
      case 'text':
        return estimateTextTokens(cPart.text, llm, debugFrom);
      case 'tool_call':
      case 'tool_response':
        console.warn('Unhandled token preview for content type:', cPart.pt);
        return 0;
    }
  } else {
    console.warn('Unhandled token preview for fragment type:', (fragment as any).ft);
    return 0;
  }
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
    if (fragment.part.pt !== 'doc') {
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