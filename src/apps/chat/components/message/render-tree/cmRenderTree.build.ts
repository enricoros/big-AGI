import type { Immutable } from '~/common/types/immutable.types';
import { DMessageAttachmentFragment, DMessageFragment, DMessageFragmentId, DMessageToolInvocationPart, DMessageToolResponsePart, isImageRefPart, isZyncAssetImageReferencePart } from '~/common/stores/chat/chat.fragments';

import type { CMCitationsFragment, CMRenderMode, CMRenderNode, CMRenderTree, CMToolCall, CMToolInvocationFragment, CMToolResponseFragment, CMTrailingOptions } from './cmRenderTree.types';
import { parseTrailingOptions } from './parseTrailingOptions';


export interface CMBuildOptions {
  /** Drops fragments before grouping; the neighbors of a hidden fragment become adjacent. Pass a stable function. */
  isVisible?: (fragment: Immutable<DMessageFragment>) => boolean;
  /** View mode: tool names whose invocation renders as a `tool-proposal`, never grouped, and whose unclaimed response emits no node and leaves the run open. */
  proposalToolNames?: ReadonlySet<string>;
  /** View mode: cut a trailing option list off the last text node into `continuationOptions`. */
  trailingOptions?: boolean;
}

// configuration
const CMRT_NOTICES_CLOSE_RUNS = true; // notice placeholders (`pType: 'notice'`) close the run around them; activity placeholders stay transparent
const CMRT_DUPLICATE_CALL_ID_RESPONSE: 'first' | 'last' = 'first'; // which response a repeated tool-call id claims
const CMRT_OPTIONS_AFTER_LAST_FRAGMENT_ONLY = true; // trailing options only when the message ends with that text
/** Fused reasoning joins its members with a blank line, like `messageFragmentsReduceText`. */
export const CMRT_REASONING_SEPARATOR = '\n\n';


export function isCMImageAttachment(fragment: Immutable<DMessageAttachmentFragment>): boolean {
  return isZyncAssetImageReferencePart(fragment.part) || isImageRefPart(fragment.part);
}


/**
 * Groups the fragments of a message into render nodes, in message order.
 *
 * - citations leave the sequence into one leading `citations` node
 * - view mode fuses adjacent text, reasoning, images and documents; consecutive invocations form one `tool-calls`
 *   node, each claiming its response wherever that sits in the message, and any other content seals the group;
 *   an invocation named in `proposalToolNames` is its own `tool-proposal` node, never grouped
 * - activity placeholders are transient and don't break the run around them; notices do
 * - edit mode gives text, errors and tool parts their own `edit-text` node, keeps reasoning as its chip, and fuses
 *   adjacent attachments of any kind
 * - a change of `originId` between fragments inserts a `separator` (attachments and citations don't take part)
 * - leaves (placeholders, errors, content images, hosted resources, references) render alone in both modes
 *
 * Pure. Identity across builds comes from `recycleCMRenderTree`. To add a node kind: declare it in
 * `cmRenderTree.types.ts`, emit it from the switch below, render it in `CMRenderTreeNodes.tsx`; the recycler only
 * needs a case when the kind nests objects with their own identity (see `tool-calls`).
 */
export function buildCMRenderTree(fragments: Immutable<DMessageFragment[]>, mode: CMRenderMode, options: CMBuildOptions = {}): CMRenderTree {
  const edit = mode === 'edit';
  const { isVisible, proposalToolNames } = options;
  const claimed = edit ? null : _claimToolResponses(fragments);

  const citations: CMCitationsFragment[] = [];
  const nodes: CMRenderNode[] = [];

  // the run still accepting members, with the mutable lists behind its readonly fields
  const run: { node: CMRenderNode | null, fragments: DMessageFragment[], calls: CMToolCall[] } = { node: null, fragments: [], calls: [] };

  // null until the first stamped fragment; unstamped fragments don't change it
  let lastOrigin: string | null = null;

  // the last fragment left in the sequence (claimed responses included): the options rule applies only right after it
  let lastInSequence: Immutable<DMessageFragment> | null = null;

  const close = () => {
    if (run.node?.kind === 'tool-calls') run.node.sealed = true; // content follows the group
    run.node = null;
  };

  const pushLeaf = (node: CMRenderNode) => {
    close();
    nodes.push(node);
  };

  const startRun = (node: CMRenderNode, members: DMessageFragment[], calls: CMToolCall[] = []) => {
    close();
    nodes.push(node);
    run.node = node;
    run.fragments = members;
    run.calls = calls;
  };

  const trackOrigin = (fragment: Immutable<DMessageFragment>) => {
    const originId = 'originId' in fragment ? fragment.originId : undefined;
    if (!originId || originId === lastOrigin) return;
    if (lastOrigin !== null)
      pushLeaf({ kind: 'separator', key: `separator:${fragment.fId}` });
    lastOrigin = originId;
  };

  for (const fragment of fragments) {
    if (isVisible && !isVisible(fragment)) continue;

    switch (fragment.ft) {

      case 'void': {
        const { part } = fragment;
        const partType: string = part.pt;
        if (part.pt === 'annotations') {
          citations.push(_withPart(fragment, part));
          break;
        }
        trackOrigin(fragment);
        lastInSequence = fragment;
        switch (part.pt) {
          case 'ma': {
            const reasoning = _withPart(fragment, part);
            if (run.node?.kind === 'reasoning') {
              run.fragments.push(reasoning);
            } else {
              const members = [reasoning];
              startRun({ kind: 'reasoning', key: `reasoning:${fragment.fId}`, fragments: members }, members);
            }
            break;
          }
          case 'ph':
            // activity placeholders are transient: the run around them goes on, so their removal changes no node; notices close it
            nodes.push({ kind: 'placeholder', key: `placeholder:${fragment.fId}`, fragment: _withPart(fragment, part) });
            if (CMRT_NOTICES_CLOSE_RUNS && part.pType === 'notice') close();
            break;
          case '_pt_sentinel':
            break;
          default: {
            const _exhaustive: never = part;
            pushLeaf({ kind: 'unknown', key: `unknown:${fragment.fId}`, fragment, reason: `void part '${partType}'` });
          }
        }
        break;
      }

      case 'attachment': {
        const kind = edit ? 'edit-attachments' : isCMImageAttachment(fragment) ? 'images' : 'documents';
        if (run.node?.kind === kind) {
          run.fragments.push(fragment);
        } else {
          const members = [fragment];
          startRun({ kind, key: `${kind}:${fragment.fId}`, fragments: members }, members);
        }
        break;
      }

      case 'content': {
        const { part } = fragment;
        const partType: string = part.pt;
        trackOrigin(fragment);
        lastInSequence = fragment;
        switch (part.pt) {
          case 'text': {
            const text = _withPart(fragment, part);
            if (edit) {
              pushLeaf({ kind: 'edit-text', key: `edit-text:${fragment.fId}`, fragment: text });
            } else if (run.node?.kind === 'text') {
              run.fragments.push(text);
            } else {
              const members = [text];
              startRun({ kind: 'text', key: `text:${fragment.fId}`, fragments: members }, members);
            }
            break;
          }
          case 'error':
            if (edit) pushLeaf({ kind: 'edit-text', key: `edit-text:${fragment.fId}`, fragment: _withPart(fragment, part) });
            else pushLeaf({ kind: 'error', key: `error:${fragment.fId}`, fragment: _withPart(fragment, part) });
            break;
          case 'tool_invocation': {
            const invocation = _withPart(fragment, part);
            if (edit) {
              pushLeaf({ kind: 'edit-text', key: `edit-text:${fragment.fId}`, fragment: invocation });
              break;
            }
            const response = claimed?.byId.get(part.id) ?? null;
            claimed?.byId.delete(part.id); // a second invocation with the same id gets no response
            const toolName = _toolName(part);
            if (toolName !== null && proposalToolNames?.has(toolName)) {
              pushLeaf({ kind: 'tool-proposal', key: `tool-proposal:${fragment.fId}`, fragment: invocation, response });
              break;
            }
            const call: CMToolCall = { id: part.id, invocation, response };
            if (run.node?.kind === 'tool-calls') {
              run.calls.push(call);
              run.fragments.push(invocation);
              if (response) run.fragments.push(response);
            } else {
              const members: (CMToolInvocationFragment | CMToolResponseFragment)[] = response ? [invocation, response] : [invocation];
              const calls = [call];
              startRun({ kind: 'tool-calls', key: `tool-calls:${fragment.fId}`, fragments: members, calls, sealed: false }, members, calls);
            }
            break;
          }
          case 'tool_response': {
            if (edit) {
              pushLeaf({ kind: 'edit-text', key: `edit-text:${fragment.fId}`, fragment: _withPart(fragment, part) });
              break;
            }
            // a claimed response renders inside its invocation's node; an unclaimed one of a proposal tool has nothing to
            // show (its status lives in the proposal) and leaves the run open; any other orphan stands alone
            if (claimed?.consumed.has(fragment.fId)) break;
            const toolName = _toolName(part);
            if (toolName !== null && proposalToolNames?.has(toolName)) break;
            pushLeaf({ kind: 'tool-response', key: `tool-response:${fragment.fId}`, fragment: _withPart(fragment, part) });
            break;
          }
          case 'image_ref':
            pushLeaf({ kind: 'image-ref', key: `image-ref:${fragment.fId}`, fragment: _withPart(fragment, part) });
            break;
          case 'reference':
            pushLeaf({ kind: 'reference', key: `reference:${fragment.fId}`, fragment: _withPart(fragment, part) });
            break;
          case 'hosted_resource':
            pushLeaf({ kind: 'hosted-resource', key: `hosted-resource:${fragment.fId}`, fragment: _withPart(fragment, part) });
            break;
          case '_pt_sentinel':
            break;
          default: {
            const _exhaustive: never = part;
            pushLeaf({ kind: 'unknown', key: `unknown:${fragment.fId}`, fragment, reason: `content part '${partType}'` });
          }
        }
        break;
      }

      case '_ft_sentinel':
        break;

      default: {
        const _exhaustive: never = fragment;
        break;
      }
    }
  }

  // rule: a trailing option list on the last text node becomes continuation buttons
  let trailingOptions: CMTrailingOptions | null = null;
  const last = nodes[nodes.length - 1];
  if (!edit && options.trailingOptions && last?.kind === 'text' && (!CMRT_OPTIONS_AFTER_LAST_FRAGMENT_ONLY || last.fragments[last.fragments.length - 1] === lastInSequence)) {
    const lastFragment = last.fragments[last.fragments.length - 1];
    const parsed = parseTrailingOptions(lastFragment.part.text);
    if (parsed)
      last.trailingOptions = trailingOptions = { fragmentId: lastFragment.fId, options: parsed.options, suffix: lastFragment.part.text.slice(parsed.beforeText.length) };
  }

  if (citations.length)
    nodes.unshift({ kind: 'citations', key: 'citations', fragments: citations });

  return { mode, nodes, trailingOptions };
}


/** View mode: each response is claimed by the first invocation with its id, wherever either sits in the message; `CMRT_DUPLICATE_CALL_ID_RESPONSE` picks the response when the id repeats. */
function _claimToolResponses(fragments: Immutable<DMessageFragment[]>): { byId: Map<string, CMToolResponseFragment>, consumed: Set<DMessageFragmentId> } | null {
  let invocationIds: Set<string> | null = null;
  for (const fragment of fragments)
    if (fragment.ft === 'content' && fragment.part.pt === 'tool_invocation')
      (invocationIds ??= new Set()).add(fragment.part.id);
  if (!invocationIds) return null;

  const byId = new Map<string, CMToolResponseFragment>();
  const consumed = new Set<DMessageFragmentId>();
  for (const fragment of fragments) {
    if (fragment.ft !== 'content' || fragment.part.pt !== 'tool_response' || !invocationIds.has(fragment.part.id))
      continue;
    const previous = byId.get(fragment.part.id);
    if (previous) {
      if (CMRT_DUPLICATE_CALL_ID_RESPONSE === 'first') continue;
      consumed.delete(previous.fId); // the earlier response stands alone
    }
    byId.set(fragment.part.id, _withPart(fragment, fragment.part));
    consumed.add(fragment.fId);
  }
  return { byId, consumed };
}

/** The function name of a tool part; null for code execution parts. */
function _toolName(part: DMessageToolInvocationPart | DMessageToolResponsePart): string | null {
  if (part.pt === 'tool_invocation') return part.invocation.type === 'function_call' ? part.invocation.name : null;
  return part.response.type === 'function_call' ? part.response.name : null;
}

/** Types a fragment by the part the caller's switch established. Same object, no copy. */
function _withPart<TFragment extends { part: unknown }, TPart extends TFragment['part']>(fragment: TFragment, _part: TPart): TFragment & { part: TPart } {
  return fragment as TFragment & { part: TPart };
}
