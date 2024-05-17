import * as React from 'react';

import { DLLM, DLLMId, LLM_IF_OAI_Vision } from '~/modules/llms/store-llms';

import { DAttachmentPart } from '~/common/stores/chat/chat.message';
import { countModelTokens } from '~/common/util/token-counter';

import type { Attachment, AttachmentId } from './attachment.types';


export interface LLMAttachments {
  attachments: LLMAttachment[];
  collapseWithAttachment: (initialTextBlockText: string | null, attachmentId: AttachmentId) => DAttachmentPart[];
  collapseWithAttachments: (initialTextBlockText: string | null) => DAttachmentPart[];
  isOutputAttacheable: boolean;
  isOutputTextInlineable: boolean;
  tokenCountApprox: number;
}

export interface LLMAttachment {
  attachment: Attachment;
  attachmentOutputs: DAttachmentPart[];
  isUnconvertible: boolean;
  isOutputMissing: boolean;
  isOutputAttachable: boolean;
  isOutputTextInlineable: boolean;
  tokenCountApprox: number | null;
}


export function useLLMAttachments(attachments: Attachment[], chatLLM: DLLM | null): LLMAttachments {
  return React.useMemo(() => {

    const supportsImages = !!chatLLM?.interfaces?.includes(LLM_IF_OAI_Vision);
    const supportedOutputPartTypes: DAttachmentPart['atype'][] = supportsImages ? ['aimage', 'atext'] : ['atext'];

    const llmAttachments = attachments.map(attachment => toLLMAttachment(attachment, supportedOutputPartTypes, chatLLM?.id || null));

    const collapseWithAttachment = (initialTextBlockText: string | null, attachmentId: AttachmentId): DAttachmentPart[] => {
      // get outputs of a specific attachment
      const outputs = attachments.find(a => a.id === attachmentId)?.outputs || [];
      return attachmentCollapseOutputs(initialTextBlockText, outputs);
    };

    const collapseWithAttachments = (initialTextBlockText: string | null) => {
      // accumulate all outputs of all attachments
      const allOutputs = llmAttachments.reduce((acc, a) => acc.concat(a.attachment.outputs), [] as DAttachmentPart[]);
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
  }, [attachments, chatLLM]);
}

export function getSingleTextBlockText(outputs: DAttachmentPart[]): string | null {
  const textOutputs = outputs.filter(part => part.atype === 'atext');
  return (textOutputs.length === 1 && textOutputs[0].atype === 'atext') ? textOutputs[0].text : null;
}


function toLLMAttachment(attachment: Attachment, supportedOutputPartTypes: DAttachmentPart['atype'][], llmForTokenCount: DLLMId | null): LLMAttachment {
  const { converters, outputs } = attachment;

  const isUnconvertible = converters.length === 0;
  const isOutputMissing = outputs.length === 0;
  const isOutputAttachable = areAllOutputsSupported(outputs, supportedOutputPartTypes);
  const isOutputTextInlineable = areAllOutputsSupported(outputs, supportedOutputPartTypes.filter(pt => pt === 'atext'));

  const attachmentOutputs = attachmentCollapseOutputs(null, outputs);
  const tokenCountApprox = llmForTokenCount
    ? attachmentOutputs.reduce((acc, output) => {
      if (output.atype === 'atext')
        return acc + (countModelTokens(output.text, llmForTokenCount, 'attachments tokens count') ?? 0);
      console.warn('Unhandled token preview for output type:', output.atype);
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

function areAllOutputsSupported(outputs: DAttachmentPart[], supportedOutputPartTypes: DAttachmentPart['atype'][]) {
  return outputs.length
    ? outputs.every(output => supportedOutputPartTypes.includes(output.atype))
    : false;
}

function attachmentCollapseOutputs(initialTextBlockText: string | null, outputs: DAttachmentPart[]) {
  const accumulatedOutputs: DAttachmentPart[] = [];

  // if there's initial text, make it a collapsible default (unquited) text block
  if (initialTextBlockText !== null) {
    accumulatedOutputs.push({
      atype: 'atext',
      text: initialTextBlockText,
      title: undefined,
      collapsible: true,
    });
  }

  // Accumulate attachment outputs of the same type and 'collapsible' into a single object of that type.
  for (const output of outputs) {
    const last = accumulatedOutputs[accumulatedOutputs.length - 1];

    // accumulationg over an existing part of the same type
    if (last && last.atype === output.atype && output.collapsible) {
      switch (last.atype) {
        case 'atext':
          last.text += `\n\n\`\`\`${output.title || ''}\n${output.text}\n\`\`\``;
          break;
        default:
          console.warn('Unhandled collapsing for output type:', output.atype);
      }
    }
    // start a new part
    else {
      accumulatedOutputs.push(output);
    }
  }

  return accumulatedOutputs;
}