import type { DLLM } from '~/modules/llms/store-llms';

import { textTokensForLLM } from '~/common/util/token-counter';

import { DMessageAttachmentFragment, DMessageFragment, isContentOrAttachmentFragment } from './chat.message';


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


// Content Parts

function _fragmentTokens(fragment: DMessageFragment, llm: DLLM, debugFrom: string): number {
  // non content/attachment fragments are ignored
  if (!isContentOrAttachmentFragment(fragment))
    return 0;
  switch (fragment.part.pt) {
    case 'text':
      if (fragment.ft === 'attachment') {
        // NOTE: the wrapFormat could be llm-dependent
        const likelyBlockRendition = marshallWrapText(fragment.part.text, fragment.title, 'markdown-code');
        return estimateTextTokens(likelyBlockRendition, llm, debugFrom);
      }
      return estimateTextTokens(fragment.part.text, llm, debugFrom);

    case 'image_ref':
      return _imagePartTokens(fragment.part.width, fragment.part.height, fragment.ft === 'attachment' ? fragment.title : '', llm);

    case 'ph':
    case 'error':
    case '_pt_sentinel':
      // purely UI elements, no tokens
      return 0;

    case 'tool_call':
    case 'tool_response':
    default:
      console.warn('Unhandled token preview for content type:', fragment.part.pt);
      return 0;
  }
}


// Attachment Fragments

export type TextAttachmentWrapFormat = false | 'markdown-code';

/**
 * API Note: you should not use this function much, as it lowers the grade of higher level information
 */
export function marshallWrapText(text: string, title: string | undefined, wrapFormat: TextAttachmentWrapFormat): string {
  if (wrapFormat === 'markdown-code')
    return `\`\`\`${title || ''}\n${text}\n\`\`\``;
  return text;
}

/**
 * API Note: you should not use this function much, as it lowers the grade of higher level information
 */
export function marshallWrapTextFragments(initialText: string | null, fragments: (/*DMessageContentFragment |*/ DMessageAttachmentFragment)[], wrapFormat: TextAttachmentWrapFormat, separator: string): string {
  let inlinedText = initialText || '';
  for (const fragment of fragments) {
    // warn on non-text fragments, which are not handled - it's an API error to call this function to non-text-part fragments
    if (fragment.part.pt !== 'text') {
      console.warn('marshallWrapTextFragments: unhandled part type:', fragment.part.pt);
      continue;
    }

    if (inlinedText.length)
      inlinedText += separator;

    inlinedText += marshallWrapText(fragment.part.text, fragment.title, wrapFormat);
  }
  return inlinedText;
}


function _imagePartTokens(width: number | undefined, height: number | undefined, debugTitle: string | undefined, llm: DLLM) {
  // for the guidelines, see `attachment.pipeline.ts` (lists the latest URLs)
  switch (llm._source?.vId) {
    case 'openai':
      // missing values
      if (!width || !height) {
        console.log(`Missing width or height for openai image tokens calculation (${debugTitle || 'no title'})`);
        return 85;
      }
      // 'detail: low' mode, has an image of (or up to) 512x512 -> 85 tokens
      if (width <= 512 && height <= 512)
        return 85;
      // 'detail: high' mode, cover the image with 512x512 patches of 170 tokens, in addition to the 85
      const patchesX = Math.ceil(width / 512);
      const patchesY = Math.ceil(height / 512);
      return 85 + patchesX * patchesY * 170;

    case 'anthropic':
      // Max case for Anthropic
      return 1600;

    case 'googleai':
      // Inferred from the Gemini Videos description, but not sure
      return 258;

    default:
      console.warn('Unhandled token preview for image with llm:', llm._source?.vId);
      return 0;
  }
}


// Encoding Glue - TODO: implement these correctly and based off LLMs

function _glueForFragmentTokens(_llm: DLLM): number {
  return 4;
}

export function glueForMessageTokens(_llm: DLLM): number {
  return 4;
}