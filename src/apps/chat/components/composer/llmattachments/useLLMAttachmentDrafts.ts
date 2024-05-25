import * as React from 'react';

import { DLLM, LLM_IF_OAI_Vision } from '~/modules/llms/store-llms';

import type { AttachmentDraft, AttachmentDraftId } from '~/common/attachment-drafts/attachment.types';
import type { DAttachmentPart } from '~/common/stores/chat/chat.message';
import { estimateTokensForAttachmentParts } from '~/common/stores/chat/chat.tokens';


export interface LLMAttachmentDrafts {
  llmAttachmentDrafts: LLMAttachmentDraft[];
  canAttachAllParts: boolean;
  canInlineAllTextParts: boolean;
  llmTokenCountApprox: number | null;
  collapseTextWithAttachmentDraft: (initialTextBlockText: string | null, attachmentDraftId: AttachmentDraftId) => DAttachmentPart[];
  collapseTextWithAttachmentDrafts: (initialTextBlockText: string | null) => DAttachmentPart[];
}

export interface LLMAttachmentDraft {
  attachmentDraft: AttachmentDraft;
  llmSupportsAllParts: boolean;
  llmSupportsTextParts: boolean;
  llmTokenCountApprox: number | null;
}


export function useLLMAttachmentDrafts(attachmentDrafts: AttachmentDraft[], chatLLM: DLLM | null): LLMAttachmentDrafts {
  return React.useMemo(() => {

    // Adjust the recommended DAttachmentPart(s) based on the LLM
    const supportsImages = !!chatLLM?.interfaces?.includes(LLM_IF_OAI_Vision);
    const supportedOutputPartTypes: DAttachmentPart['atype'][] = supportsImages ? ['aimage', 'atext'] : ['atext'];
    const supportedTextPartTypes = supportedOutputPartTypes.filter(pt => pt === 'atext');

    // Add LLM-specific properties to each attachment draft
    const llmAttachmentDrafts = attachmentDrafts.map((a): LLMAttachmentDraft => ({
      attachmentDraft: a,
      llmSupportsAllParts: areAllOutputsSupported(a.outputParts, supportedOutputPartTypes),
      llmSupportsTextParts: areAllOutputsSupported(a.outputParts, supportedTextPartTypes),
      llmTokenCountApprox: chatLLM
        ? estimateTokensForAttachmentParts(a.outputParts, chatLLM, true, 'useLLMAttachmentDrafts')
        : null,
    }));

    // Calculate the overall properties
    const canAttachAllParts = llmAttachmentDrafts.every(a => a.llmSupportsAllParts);
    const canInlineAllTextParts = llmAttachmentDrafts.every(a => a.llmSupportsTextParts);
    const llmTokenCountApprox = chatLLM
      ? llmAttachmentDrafts.reduce((acc, a) => acc + (a.llmTokenCountApprox || 0), 0)
      : null;

    return {
      llmAttachmentDrafts,
      canAttachAllParts,
      canInlineAllTextParts,
      llmTokenCountApprox,
      collapseTextWithAttachmentDraft: (initialTextBlockText: string | null, attachmentDraftId: AttachmentDraftId): DAttachmentPart[] => {
        // get outputs of a specific attachment
        const outputs = attachmentDrafts.find(a => a.id === attachmentDraftId)?.outputParts || [];
        return attachmentCollapseOutputs(initialTextBlockText, outputs);
      },
      collapseTextWithAttachmentDrafts: (initialTextBlockText: string | null) => {
        // accumulate all outputs of all attachmentDrafts
        const allOutputs = llmAttachmentDrafts.reduce((acc, a) => acc.concat(a.attachmentDraft.outputParts), [] as DAttachmentPart[]);
        return attachmentCollapseOutputs(initialTextBlockText, allOutputs);
      },
    };
  }, [attachmentDrafts, chatLLM]);
}

// TODO: (re/)move this?
export function getSingleTextBlockText(outputs: DAttachmentPart[]): string | null {
  const textOutputs = outputs.filter(part => part.atype === 'atext');
  return (textOutputs.length === 1 && textOutputs[0].atype === 'atext') ? textOutputs[0].text : null;
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
