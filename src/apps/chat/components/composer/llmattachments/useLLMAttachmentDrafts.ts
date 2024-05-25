import * as React from 'react';

import { DLLM, DLLMId, LLM_IF_OAI_Vision } from '~/modules/llms/store-llms';

import type { DAttachmentPart } from '~/common/stores/chat/chat.message';
import { textTokensForLLMId } from '~/common/util/token-counter';

import type { AttachmentDraft, AttachmentDraftId } from '~/common/attachment-drafts/attachment.types';


export interface LLMAttachmentDrafts {
  attachmentDrafts: LLMAttachmentDraft[];
  canAttachAllParts: boolean;
  canInlineAllTextParts: boolean;
  llmTokenCountApprox: number;
  collapseTextWithAttachmentDraft: (initialTextBlockText: string | null, attachmentDraftId: AttachmentDraftId) => DAttachmentPart[];
  collapseTextWithAttachmentDrafts: (initialTextBlockText: string | null) => DAttachmentPart[];
}

export interface LLMAttachmentDraft {
  attachmentDraft: AttachmentDraft;
  llmSupportsAllParts: boolean;
  llmSupportsTextParts: boolean;
  llmTokenCountApprox: number | null;
}


export function useLLMAttachmentDrafts(attachments: AttachmentDraft[], chatLLM: DLLM | null): LLMAttachmentDrafts {
  return React.useMemo(() => {

    // Adjust the recommended DAttachmentPart(s) based on the LLM
    const supportsImages = !!chatLLM?.interfaces?.includes(LLM_IF_OAI_Vision);
    const supportedOutputPartTypes: DAttachmentPart['atype'][] = supportsImages ? ['aimage', 'atext'] : ['atext'];

    const llmAttachments = attachments.map(attachment =>
      toLLMAttachment(attachment, supportedOutputPartTypes, chatLLM?.id || null));

    return {
      attachmentDrafts: llmAttachments,
      canAttachAllParts: llmAttachments.every(a => a.llmSupportsAllParts),
      canInlineAllTextParts: llmAttachments.every(a => a.llmSupportsTextParts),
      llmTokenCountApprox: llmAttachments.reduce((acc, a) => acc + (a.llmTokenCountApprox || 0), 0),
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


function toLLMAttachment(attachmentDraft: AttachmentDraft, llmSupportedOutputPartTypes: DAttachmentPart['atype'][], llmForTokenCount: DLLMId | null): LLMAttachmentDraft {
  const { outputParts } = attachmentDraft;

  const attachmentCollapsedParts = attachmentCollapseOutputs(null, outputParts);
  const llmTokenCountApprox = llmForTokenCount
    ? attachmentCollapsedParts.reduce((acc, output) => {
      if (output.atype === 'atext')
        return acc + (textTokensForLLMId(output.text, llmForTokenCount, 'attachments tokens count') ?? 0);
      console.warn('Unhandled token preview for output type:', output.atype);
      return acc;
    }, 0)
    : null;

  return {
    attachmentDraft: attachmentDraft,
    llmSupportsAllParts: areAllOutputsSupported(outputParts, llmSupportedOutputPartTypes),
    llmSupportsTextParts: areAllOutputsSupported(outputParts, llmSupportedOutputPartTypes.filter(pt => pt === 'atext')),
    llmTokenCountApprox,
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
