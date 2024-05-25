import type { DLLM } from '~/modules/llms/store-llms';

import { textTokensForLLM } from '~/common/util/token-counter';

import type { DAttachmentPart, DContentParts } from './chat.message';


// export function estimateTokensForComposer(text: string, parts: DAttachmentPart[], llm: DLLM, debugFrom: string) {
//   const textTokens = text?.trim() ? estimateTextTokens(text, llm, debugFrom) : 0;
//   return textTokens + estimateTokensForAttachmentParts(parts, llm, textTokens > 0, debugFrom);
// }

export function estimateTokensForContentParts(content: DContentParts, llm: DLLM, debugFrom: string) {
  return content.reduce((acc, part) => {
    let partTokens = _contentPartTokens(part, llm, debugFrom);
    if (acc > 0)
      partTokens += _glueForContentPartTokens(llm);
    return acc + partTokens;
  }, 0);
}

export function estimateTokensForAttachmentParts(parts: DAttachmentPart[], llm: DLLM, addTopGlue: boolean, debugFrom: string) {
  return parts.reduce((acc, part) => {
    let partTokens = _attachmentPartTokens(part, llm, debugFrom);
    if (acc > 0 || addTopGlue)
      partTokens += _glueForAttachmentPartTokens(llm);
    return acc + partTokens;
  }, 0);
}


// Text

export function estimateTextTokens(text: string, llm: DLLM, debugFrom: string): number {
  return textTokensForLLM(text, llm, debugFrom) ?? 0;
}


// Content Parts

function _contentPartTokens(part: DContentParts[number], llm: DLLM, debugFrom: string): number {
  switch (part.ptype) {
    case 'text':
      return estimateTextTokens(part.text, llm, debugFrom) ?? 0;

    case 'image':
      return _attachmentPartImageTokens(part.width, part.height, part.title, llm);

    case 'function_call':
    case 'function_response':
    default:
      console.warn('Unhandled token preview for content type:', (part as any).ptype);
      return 0;
  }
}


// Attachment Parts

function _attachmentPartTokens(part: DAttachmentPart, llm: DLLM, debugFrom: string): number {
  switch (part.atype) {
    case 'atext':
      return _attachmentPartTextTokens(part.title, part.text, llm, debugFrom) ?? 0;

    case 'aimage':
      return _attachmentPartImageTokens(part.width, part.height, part.title, llm);

    default:
      console.warn('Unhandled token preview for output type:', (part as any).atype);
      return 0;
  }
}

export type TextAttachmentWrapFormat = false | 'markdown-code';

export function attachmentWrapText(text: string, title: string | undefined, wrapFormat: TextAttachmentWrapFormat): string {
  if (wrapFormat === 'markdown-code')
    return `\`\`\`${title || ''}\n${text}\n\`\`\``;
  return text;
}

function _attachmentPartTextTokens(title: string | undefined, text: string, llm: DLLM, debugFrom: string): number {
  const likelyBlockRendition = attachmentWrapText(text, title, 'markdown-code');
  return estimateTextTokens(likelyBlockRendition, llm, debugFrom);
}

function _attachmentPartImageTokens(width: number | undefined, height: number | undefined, debugTitle: string | undefined, llm: DLLM) {
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

function _glueForContentPartTokens(_llm: DLLM): number {
  return 4;
}

function _glueForAttachmentPartTokens(_llm: DLLM): number {
  return 4;
}

export function glueForMessageTokens(_llm: DLLM): number {
  return 4;
}