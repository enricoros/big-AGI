import type * as React from 'react';

import type { DComposerPendingPart } from '~/common/chat-overlay/store-perchat-composer_slice';
import type { DLLM } from '~/common/stores/llms/llms.types';


/**
 * Attachment Input Enhancers: static, per-surface specializations of the attachment intake
 * (Composer today - any surface that uses `useAttachmentDrafts` can compose a list).
 *
 * Design rules (keep them, they are the point):
 * - enhancers are PLAIN OBJECTS defined at module scope: referentially stable forever, no hooks
 *   inside the contract, components are stable references - nothing here can invalidate memos
 * - every function is pure and cheap (called in render memos and on paste events only)
 * - each surface composes its own static list (`[videoUrlInputEnhancer, ...]`) - no runtime registration
 * - an enhancer that intercepts text BYPASSES the attachment pipeline: the part it returns is
 *   held pending in the composer overlay (chips), then harvested as content fragments at send
 */
export interface AttachmentInputEnhancer {

  id: string;

  /** Capability gate - e.g. `llm?.interfaces.includes(LLM_IF_Inputs_Video)`. Called in render memos: keep cheap. */
  isEnabled(llm: DLLM | null): boolean;

  /** Optional placeholder fragment shown when enabled, e.g. 'paste a video link'. Merged by the surface. */
  placeholderHint?(llm: DLLM): string | null;

  /**
   * Intake choke point: offered single-line pasted/dropped text BEFORE the URL/attachment branches.
   * Return a pending part to consume the text, or null to fall through to the normal pipeline.
   */
  interceptText?(text: string, llm: DLLM): DComposerPendingPart | null;

  /** True when this enhancer owns the given pending part (chip dispatch). */
  ownsPart(part: DComposerPendingPart): boolean;

  /** Chip renderer for pending parts this enhancer owns. Stable reference (module-scope component). */
  PendingChip: React.ComponentType<{ part: DComposerPendingPart, onRemove: () => void }>;

}


/** Options threaded into the attachment-drafts intake hook by surfaces that support enhancers. */
export interface AttachmentInputEnhancersOptions {
  enhancers: readonly AttachmentInputEnhancer[];
  enhancerLLM: DLLM | null;
  onEnhancerAddPendingPart: (part: DComposerPendingPart) => void;
}


/** Runs the intercept chain: first enabled enhancer that returns a part wins. */
export function attachmentEnhancersInterceptText(options: AttachmentInputEnhancersOptions | undefined, text: string): DComposerPendingPart | null {
  if (!options?.enhancers.length || !options.enhancerLLM) return null;
  const singleLine = text.trim();
  if (!singleLine || singleLine.includes('\n')) return null;
  for (const enhancer of options.enhancers)
    if (enhancer.interceptText && enhancer.isEnabled(options.enhancerLLM)) {
      const part = enhancer.interceptText(singleLine, options.enhancerLLM);
      if (part) return part;
    }
  return null;
}


/** Merges the placeholder hints of the enabled enhancers (surface joins them into its placeholder). */
export function attachmentEnhancersPlaceholderHints(enhancers: readonly AttachmentInputEnhancer[], llm: DLLM | null): string[] {
  if (!llm) return [];
  const hints: string[] = [];
  for (const enhancer of enhancers)
    if (enhancer.placeholderHint && enhancer.isEnabled(llm)) {
      const hint = enhancer.placeholderHint(llm);
      if (hint) hints.push(hint);
    }
  return hints;
}
