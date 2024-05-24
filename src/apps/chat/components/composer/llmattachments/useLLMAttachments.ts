import * as React from 'react';

import { DLLM, DLLMId, LLM_IF_OAI_Vision } from '~/modules/llms/store-llms';

import type { DAttachmentPart } from '~/common/stores/chat/chat.message';
import { countModelTokens } from '~/common/util/token-counter';

import type { AttachmentDraft, AttachmentDraftId } from '~/common/attachment-drafts/attachment.types';


export interface LLMAttachments {
  attachments: LLMAttachment[];
  isOutputAttacheable: boolean;
  isOutputTextInlineable: boolean;
  tokenCountApprox: number;
  collapseTextWithAttachmentDraft: (initialTextBlockText: string | null, attachmentDraftId: AttachmentDraftId) => DAttachmentPart[];
  collapseTextWithAttachmentDrafts: (initialTextBlockText: string | null) => DAttachmentPart[];
}

export interface LLMAttachment {
  attachmentDraft: AttachmentDraft;
  attachmentDraftCollapsedParts: DAttachmentPart[];
  isUnconvertible: boolean;
  isOutputMissing: boolean;
  isOutputAttachable: boolean;
  isOutputTextInlineable: boolean;
  tokenCountApprox: number | null;
}


export function useLLMAttachments(attachments: AttachmentDraft[], chatLLM: DLLM | null): LLMAttachments {
  return React.useMemo(() => {

    // Adjust the recommended DAttachmentPart(s) based on the LLM
    const supportsImages = !!chatLLM?.interfaces?.includes(LLM_IF_OAI_Vision);
    const supportedOutputPartTypes: DAttachmentPart['atype'][] = supportsImages ? ['aimage', 'atext'] : ['atext'];

    const llmAttachments = attachments.map(attachment => toLLMAttachment(attachment, supportedOutputPartTypes, chatLLM?.id || null));

    return {
      attachments: llmAttachments,
      isOutputAttacheable: llmAttachments.every(a => a.isOutputAttachable),
      isOutputTextInlineable: llmAttachments.every(a => a.isOutputTextInlineable),
      tokenCountApprox: llmAttachments.reduce((acc, a) => acc + (a.tokenCountApprox || 0), 0),
      collapseTextWithAttachmentDraft: (initialTextBlockText: string | null, attachmentDraftId: AttachmentDraftId): DAttachmentPart[] => {
        // get outputs of a specific attachment
        const outputs = attachments.find(a => a.id === attachmentDraftId)?.outputParts || [];
        return attachmentCollapseOutputs(initialTextBlockText, outputs);
      },
      collapseTextWithAttachmentDrafts: (initialTextBlockText: string | null) => {
        // accumulate all outputs of all attachments
        const allOutputs = llmAttachments.reduce((acc, a) => acc.concat(a.attachmentDraft.outputParts), [] as DAttachmentPart[]);
        return attachmentCollapseOutputs(initialTextBlockText, allOutputs);
      },
    };
  }, [attachments, chatLLM]);
}

// TODO: (re/)move this?
export function getSingleTextBlockText(outputs: DAttachmentPart[]): string | null {
  const textOutputs = outputs.filter(part => part.atype === 'atext');
  return (textOutputs.length === 1 && textOutputs[0].atype === 'atext') ? textOutputs[0].text : null;
}


function toLLMAttachment(attachmentDraft: AttachmentDraft, supportedOutputPartTypes: DAttachmentPart['atype'][], llmForTokenCount: DLLMId | null): LLMAttachment {
  const { converters, outputParts } = attachmentDraft;

  const isUnconvertible = converters.length === 0;
  const isOutputMissing = outputParts.length === 0;
  const isOutputAttachable = areAllOutputsSupported(outputParts, supportedOutputPartTypes);
  const isOutputTextInlineable = areAllOutputsSupported(outputParts, supportedOutputPartTypes.filter(pt => pt === 'atext'));

  const attachmentCollapsedParts = attachmentCollapseOutputs(null, outputParts);
  const tokenCountApprox = llmForTokenCount
    ? attachmentCollapsedParts.reduce((acc, output) => {
      if (output.atype === 'atext')
        return acc + (countModelTokens(output.text, llmForTokenCount, 'attachments tokens count') ?? 0);
      console.warn('Unhandled token preview for output type:', output.atype);
      return acc;
    }, 0)
    : null;

  return {
    attachmentDraft: attachmentDraft,
    attachmentDraftCollapsedParts: attachmentCollapsedParts,
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
