import type { DMessageAttachmentFragment, DMessageContentFragment, DMessageErrorPart, DMessageFragment, DMessageFragmentId, DMessageHostedResourcePart, DMessageReferencePart, DMessageTextPart, DMessageToolInvocationPart, DMessageToolResponsePart, DMessageVoidFragment, DVoidFragmentModelAnnotations, DVoidModelAuxPart, DVoidPlaceholderPart } from '~/common/stores/chat/chat.fragments';


/**
 * CMRenderTree: the fragments of a message grouped into the nodes ChatMessage renders, in render order.
 *
 * `buildCMRenderTree` derives it from the fragments (pure). `recycleCMRenderTree` then returns the previous
 * node objects, keys and arrays wherever nothing changed, so a streaming append usually replaces one node and
 * memoized renderers skip the rest. Treat a tree as immutable once built.
 */

export type CMRenderMode = 'view' | 'edit';


// fragments narrowed to one part

export type CMTextFragment = DMessageContentFragment & { part: DMessageTextPart };
export type CMErrorFragment = DMessageContentFragment & { part: DMessageErrorPart };
export type CMToolInvocationFragment = DMessageContentFragment & { part: DMessageToolInvocationPart };
export type CMToolResponseFragment = DMessageContentFragment & { part: DMessageToolResponsePart };
export type CMImageRefFragment = DMessageContentFragment & { part: Extract<DMessageContentFragment['part'], { pt: 'image_ref' }> };
export type CMReferenceFragment = DMessageContentFragment & { part: DMessageReferencePart };
export type CMHostedResourceFragment = DMessageContentFragment & { part: DMessageHostedResourcePart };
export type CMReasoningFragment = DMessageVoidFragment & { part: DVoidModelAuxPart };
export type CMPlaceholderFragment = DMessageVoidFragment & { part: DVoidPlaceholderPart };
export type CMCitationsFragment = DVoidFragmentModelAnnotations;
export type CMEditTextFragment = CMTextFragment | CMErrorFragment | CMToolInvocationFragment | CMToolResponseFragment;


/** An option list at the end of the last text node: `options` become continuation buttons, `suffix` is the text cut from `fragmentId`. */
export interface CMTrailingOptions {
  fragmentId: DMessageFragmentId;
  options: readonly string[];
  suffix: string;
}


// nodes

interface _CMNodeBase<TKind extends string> {
  kind: TKind;
  /**
   * React key and recycling identity. Built as `kind:fId` of the first member (hoisted `citations` is a singleton). The
   * recycler carries a key forward while the node shares a fragment with its predecessor, so a reorder or the
   * removal of the first member does not remount.
   */
  key: string;
}

// view: hoisted to the top; in place when ungrouped
export interface CMNodeCitations extends _CMNodeBase<'citations'> {
  fragments: readonly CMCitationsFragment[];
}

// view: runs of adjacent fragments
export interface CMNodeReasoning extends _CMNodeBase<'reasoning'> {
  fragments: readonly CMReasoningFragment[];
}

/** Adjacent text fragments. One node for identity; the members still render as separate blocks. */
export interface CMNodeText extends _CMNodeBase<'text'> {
  fragments: readonly CMTextFragment[];
  /** The trailing option list cut off the last member's display text; the same object as `CMRenderTree.trailingOptions`. */
  trailingOptions?: CMTrailingOptions;
}

export interface CMNodeImages extends _CMNodeBase<'images'> {
  fragments: readonly DMessageAttachmentFragment[];
}

export interface CMNodeDocuments extends _CMNodeBase<'documents'> {
  fragments: readonly DMessageAttachmentFragment[];
}

export interface CMToolCall {
  /** The tool call id shared by the invocation and its response. */
  id: string;
  invocation: CMToolInvocationFragment;
  response: CMToolResponseFragment | null;
}

export interface CMNodeToolCalls extends _CMNodeBase<'tool-calls'> {
  /** Each invocation, followed by its claimed response. */
  fragments: readonly (CMToolInvocationFragment | CMToolResponseFragment)[];
  calls: readonly CMToolCall[];
  /** Content follows the group in the message; a renderer may collapse sealed groups. */
  sealed: boolean;
}

/** An invocation that renders as an interactive proposal (see `CMBuildOptions.proposalToolNames`), never grouped. */
export interface CMNodeToolProposal extends _CMNodeBase<'tool-proposal'> {
  fragment: CMToolInvocationFragment;
  response: CMToolResponseFragment | null;
}

/** A boundary between the fragments of different actors (Beam fusions stamp `originId`). */
export interface CMNodeSeparator extends _CMNodeBase<'separator'> {
}

// leaves, both modes
export interface CMNodePlaceholder extends _CMNodeBase<'placeholder'> {
  fragment: CMPlaceholderFragment;
}

export interface CMNodeError extends _CMNodeBase<'error'> {
  fragment: CMErrorFragment;
}

export interface CMNodeImageRef extends _CMNodeBase<'image-ref'> {
  fragment: CMImageRefFragment;
}

export interface CMNodeReference extends _CMNodeBase<'reference'> {
  fragment: CMReferenceFragment;
}

export interface CMNodeHostedResource extends _CMNodeBase<'hosted-resource'> {
  fragment: CMHostedResourceFragment;
}

/** A tool response without an invocation in the message. */
export interface CMNodeToolResponse extends _CMNodeBase<'tool-response'> {
  fragment: CMToolResponseFragment;
}

export interface CMNodeUnknown extends _CMNodeBase<'unknown'> {
  fragment: DMessageFragment;
  reason: string;
}

// edit mode
export interface CMNodeEditText extends _CMNodeBase<'edit-text'> {
  fragment: CMEditTextFragment;
}

export interface CMNodeEditAttachments extends _CMNodeBase<'edit-attachments'> {
  fragments: readonly DMessageAttachmentFragment[];
}

export type CMRenderNode =
  | CMNodeCitations
  | CMNodeReasoning
  | CMNodeText
  | CMNodeImages
  | CMNodeDocuments
  | CMNodeToolCalls
  | CMNodeToolProposal
  | CMNodeSeparator
  | CMNodePlaceholder
  | CMNodeError
  | CMNodeImageRef
  | CMNodeReference
  | CMNodeHostedResource
  | CMNodeToolResponse
  | CMNodeUnknown
  | CMNodeEditText
  | CMNodeEditAttachments;


export interface CMRenderTree {
  mode: CMRenderMode;
  nodes: readonly CMRenderNode[];
  /** The option list cut off the last text node, when the rule is on and matched. */
  trailingOptions: CMTrailingOptions | null;
}


const _NO_FRAGMENTS: readonly DMessageFragment[] = [];

/** The fragments a node renders, in node order. */
export function cmNodeFragments(node: CMRenderNode): readonly DMessageFragment[] {
  if ('fragments' in node) return node.fragments;
  if (node.kind === 'separator') return _NO_FRAGMENTS;
  if (node.kind === 'tool-proposal') return node.response ? [node.fragment, node.response] : [node.fragment];
  return [node.fragment];
}
