import * as React from 'react';

import type { DLLMId } from '~/modules/llms/store-llms';

import { countModelTokens } from '~/common/util/token-counter';

import type { Attachment, AttachmentId } from './store-attachments';
import type { ComposerOutputMultiPart, ComposerOutputPartType } from '../composer.types';


export interface LLMAttachments {
  attachments: LLMAttachment[];
  inlineTextAttachment: (attachmentId: AttachmentId) => string | null;
  inlineTextAttachments: () => string | null;
  isOutputAttacheable: boolean;
  isOutputTextInlineable: boolean;
  tokenCountApprox: number;
}

export interface LLMAttachment {
  attachment: Attachment;
  isUnconvertible: boolean;
  isOutputMissing: boolean;
  isOutputAttachable: boolean;
  isOutputTextInlineable: boolean;
  tokenCountApprox: number | null;
}


export function useLLMAttachments(attachments: Attachment[], chatLLMId: DLLMId | null): LLMAttachments {
  return React.useMemo(() => {

    // HACK: in the future, switch to LLM capabilities (LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, etc.)
    const supportsImages = !!chatLLMId?.endsWith('-vision-preview');
    const supportedOutputPartTypes: ComposerOutputPartType[] = supportsImages ? ['text-block', 'image-part'] : ['text-block'];

    const llmAttachments = attachments.map(attachment => toLLMAttachment(attachment, supportedOutputPartTypes, chatLLMId));

    const inlineTextAttachment = (attachmentId: AttachmentId): string | null => {
      const outputs = attachments.find(a => a.id === attachmentId)?.outputs || [];
      const collapsedTextOutputs = attachmentCollapseOutputs(outputs.filter(part => part.type === 'text-block'));
      return (collapsedTextOutputs.length === 1 && collapsedTextOutputs[0].type === 'text-block') ? collapsedTextOutputs[0].text : null;
    };

    const inlineTextAttachments = (): string | null => {
      // accumulate all outputs of all attachments
      const outputs = llmAttachments.reduce((acc, a) => acc.concat(a.attachment.outputs), [] as ComposerOutputMultiPart);
      const collapsedTextOutputs = attachmentCollapseOutputs(outputs.filter(part => part.type === 'text-block'));
      return (collapsedTextOutputs.length === 1 && collapsedTextOutputs[0].type === 'text-block') ? collapsedTextOutputs[0].text : null;
    };

    return {
      attachments: llmAttachments,
      inlineTextAttachment,
      inlineTextAttachments,
      isOutputAttacheable: llmAttachments.every(a => a.isOutputAttachable),
      isOutputTextInlineable: llmAttachments.every(a => a.isOutputTextInlineable),
      tokenCountApprox: llmAttachments.reduce((acc, a) => acc + (a.tokenCountApprox || 0), 0),
    };
  }, [attachments, chatLLMId]);
}


function toLLMAttachment(attachment: Attachment, supportedOutputPartTypes: ComposerOutputPartType[], llmForTokenCount: DLLMId | null): LLMAttachment {
  const { converters, outputs } = attachment;

  const isUnconvertible = converters.length === 0;
  const isOutputMissing = outputs.length === 0;
  const isOutputAttachable = areAllOutputsSupported(outputs, supportedOutputPartTypes);
  const isOutputTextInlineable = areAllOutputsSupported(outputs, supportedOutputPartTypes.filter(pt => pt === 'text-block'));

  const _collapsedOutputs = attachmentCollapseOutputs(outputs);
  const approxTokenCount = llmForTokenCount
    ? _collapsedOutputs.reduce((acc, output) => {
      if (output.type === 'text-block')
        return acc + countModelTokens(output.text, llmForTokenCount, 'attachments tokens count');
      console.warn('Unhandled token preview for output type:', output.type);
      return acc;
    }, 0)
    : null;

  return {
    attachment,
    isUnconvertible,
    isOutputMissing,
    isOutputAttachable,
    isOutputTextInlineable,
    tokenCountApprox: approxTokenCount,
  };
}


function areAllOutputsSupported(outputs: ComposerOutputMultiPart, supportedOutputPartTypes: ComposerOutputPartType[]) {
  return outputs.length
    ? outputs.every(output => supportedOutputPartTypes.includes(output.type))
    : false;
}

export function attachmentCollapseOutputs(outputs: ComposerOutputMultiPart): ComposerOutputMultiPart {
  const accumulatedOutputs: ComposerOutputMultiPart = [];

  // Accumulate attachment outputs of the same type and 'collapsible' into a single object of that type.
  for (const output of outputs) {
    const last = accumulatedOutputs[accumulatedOutputs.length - 1];

    // accumulationg over an existing part of the same type
    if (last && last.type === output.type && output.collapsible) {
      switch (last.type) {
        case 'text-block':
          last.text += `\n\n\`\`\`${output.title}\n${output.text}\n\`\`\``;
          break;
        default:
          console.warn('Unhandled collapsing for output type:', output.type);
      }
    }
    // start a new part
    else {
      if (output.type === 'text-block') {
        accumulatedOutputs.push({
          type: 'text-block',
          text: `\n\n\`\`\`${output.title}\n${output.text}\n\`\`\``,
          title: null,
          collapsible: false,
        });
      } else {
        accumulatedOutputs.push(output);
      }
    }
  }

  return accumulatedOutputs;
}