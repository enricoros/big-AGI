import * as React from 'react';

import type { DLLMId } from '~/modules/llms/store-llms';

import { countModelTokens } from '~/common/util/token-counter';

import type { Attachment, AttachmentId } from './store-attachments';
import type { ComposerOutputMultiPart, ComposerOutputPartType } from '../composer.types';


export interface LLMAttachments {
  attachments: LLMAttachment[];
  collapseWithAttachment: (initialTextBlockText: string | null, attachmentId: AttachmentId) => ComposerOutputMultiPart;
  collapseWithAttachments: (initialTextBlockText: string | null) => ComposerOutputMultiPart;
  isOutputAttacheable: boolean;
  isOutputTextInlineable: boolean;
  tokenCountApprox: number;
}

export interface LLMAttachment {
  attachment: Attachment;
  attachmentOutputs: ComposerOutputMultiPart;
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

    const collapseWithAttachment = (initialTextBlockText: string | null, attachmentId: AttachmentId): ComposerOutputMultiPart => {
      // get outputs of a specific attachment
      const outputs = attachments.find(a => a.id === attachmentId)?.outputs || [];
      return attachmentCollapseOutputs(initialTextBlockText, outputs);
    };

    const collapseWithAttachments = (initialTextBlockText: string | null): ComposerOutputMultiPart => {
      // accumulate all outputs of all attachments
      const allOutputs = llmAttachments.reduce((acc, a) => acc.concat(a.attachment.outputs), [] as ComposerOutputMultiPart);
      return attachmentCollapseOutputs(initialTextBlockText, allOutputs);
    };

    return {
      attachments: llmAttachments,
      collapseWithAttachment,
      collapseWithAttachments,
      isOutputAttacheable: llmAttachments.every(a => a.isOutputAttachable),
      isOutputTextInlineable: llmAttachments.every(a => a.isOutputTextInlineable),
      tokenCountApprox: llmAttachments.reduce((acc, a) => acc + (a.tokenCountApprox || 0), 0),
    };
  }, [attachments, chatLLMId]);
}

export function getSingleTextBlockText(outputs: ComposerOutputMultiPart): string | null {
  const textOutputs = outputs.filter(part => part.type === 'text-block');
  return (textOutputs.length === 1 && textOutputs[0].type === 'text-block') ? textOutputs[0].text : null;
}


function toLLMAttachment(attachment: Attachment, supportedOutputPartTypes: ComposerOutputPartType[], llmForTokenCount: DLLMId | null): LLMAttachment {
  const { converters, outputs } = attachment;

  const isUnconvertible = converters.length === 0;
  const isOutputMissing = outputs.length === 0;
  const isOutputAttachable = areAllOutputsSupported(outputs, supportedOutputPartTypes);
  const isOutputTextInlineable = areAllOutputsSupported(outputs, supportedOutputPartTypes.filter(pt => pt === 'text-block'));

  const attachmentOutputs = attachmentCollapseOutputs(null, outputs);
  const tokenCountApprox = llmForTokenCount
    ? attachmentOutputs.reduce((acc, output) => {
      if (output.type === 'text-block')
        return acc + (countModelTokens(output.text, llmForTokenCount, 'attachments tokens count') ?? 0);
      console.warn('Unhandled token preview for output type:', output.type);
      return acc;
    }, 0)
    : null;

  return {
    attachment,
    attachmentOutputs,
    isUnconvertible,
    isOutputMissing,
    isOutputAttachable,
    isOutputTextInlineable,
    tokenCountApprox,
  };
}

function areAllOutputsSupported(outputs: ComposerOutputMultiPart, supportedOutputPartTypes: ComposerOutputPartType[]) {
  return outputs.length
    ? outputs.every(output => supportedOutputPartTypes.includes(output.type))
    : false;
}

function attachmentCollapseOutputs(initialTextBlockText: string | null, outputs: ComposerOutputMultiPart): ComposerOutputMultiPart {
  const accumulatedOutputs: ComposerOutputMultiPart = [];

  // if there's initial text, make it a collapsible default (unquited) text block
  if (initialTextBlockText !== null) {
    accumulatedOutputs.push({
      type: 'text-block',
      text: initialTextBlockText,
      title: null,
      collapsible: true,
    });
  }

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
        // THIS IS NOT CORRECT - we seem to be doing it just for downstream token counting - FIX IT
        // Do not serialize here
        accumulatedOutputs.push({
          type: 'text-block',
          text: `\n\n\`\`\`${output.title}\n${output.text}\n\`\`\``,
          title: null,
          collapsible: false, // Wrong
        });
      } else {
        accumulatedOutputs.push(output);
      }
    }
  }

  return accumulatedOutputs;
}