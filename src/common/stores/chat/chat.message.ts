import { agiUuid } from '~/common/util/idUtils';

import { createPlaceholderVoidFragment, createTextContentFragment, DMessageFragment, duplicateDMessageFragments } from './chat.fragments';

import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DMetricsChatGenerate_Md } from '~/common/stores/metrics/metrics.chatgenerate';
import type { Immutable } from '~/common/types/immutable.types';


// Message

export interface DMessage {
  id: DMessageId;                     // unique message ID

  role: DMessageRole;
  fragments: DMessageFragment[];      // fragments can be content/attachments/... implicitly ordered

  // pending state (not stored)
  pendingIncomplete?: boolean;        // if true, the message is incomplete (e.g. tokens won't be computed)

  // TODO: @deprecated - move to a Persona ID of the persona who wrote it, and still, could be teamwork...
  purposeId?: string;                 // only assistant/system

  metadata?: DMessageMetadata;        // Semantic augmentation, mainly at creation

  generator?: DMessageGenerator;      // Assistant generator info, and metrics

  // Session metadata for multi-turn agentic sessions was considered here (see commit 3cd38f47)
  // but vendor session state (container IDs, response handles) is stored on DMessageGenerator
  // fields instead (upstreamContainer, upstreamHandle) - simpler plumbing, no persistence migration.
  // sessionMetadata?: DMessageSessionMetadata;

  userFlags?: DMessageUserFlag[];     // (UI) user-set per-message flags

  // TODO: @deprecated remove this, it's really view-dependent
  tokenCount: number;                 // cache for token count, using the current Conversation model (0 = not yet calculated)

  // TODO: add a Beam JSON state load/store
  // volatileBeamRestore?: object;

  created: number;                    // created timestamp
  updated: number | null;             // updated timestamp - null means incomplete - TODO: disambiguate vs pendingIncomplete
}

export type DMessageId = string;

export type DMessageRole = 'user' | 'assistant' | 'system';

// Superseded by DMessageGenerator.upstreamContainer / .upstreamHandle - see note above.
// export type DMessageSessionMetadata = Record<string, string | number | boolean | null>;


// Message > Metadata

export interface DMessageMetadata {
  inReferenceTo?: DMetaReferenceItem[]; // text this was in reply to
  entangled?: DMessageEntangled; // entangled messages info
  /**
   * Initially intended recipients of this message.
   * Defaults to `undefined` i.e. the current persona for the active operation (chat, beam, etc).
   * If set, has to be honored by the UI and the sending operation.
   */
  initialRecipients?: DMessageRecipientPersona[];
  // NOTE: if adding fields, manually update `duplicateDMessageMetadata`
}

/** A textual reference to a text snipped, by a certain role. */
export interface DMetaReferenceItem {
  mrt: 'dmsg';                        // for future type discrimination
  mText: string;
  mRole: DMessageRole;
  // messageId?: string;
}

/** Entangled messages info for coordinated multi-chat operations. */
export interface DMessageEntangled {
  id: string;           // entanglement group ID
  color: string;        // hex color for visual connection
  count: number;        // total number of chats this was sent to
}

/** Recipient of a message - currently persona-based but extensible for future recipient types. */
export interface DMessageRecipientPersona {
  rt: 'persona'; // recipient type discriminant
  personaUid: string | null; // null = explicit "no persona"
}


// Message > User Flags

export type DMessageUserFlag =
  | 'aix.skip'                        // mark this message as skipped during generation (won't be sent to the LLM)
  | 'starred'                         // user has starred this message
  | 'notify.complete'                 // user has requested a notification when this message is complete
  | 'vnd.ant.cache.auto'              // [Anthropic] user requested breakpoints to be added automatically (per conversation)
  | 'vnd.ant.cache.user'              // [Anthropic] user requestd for a breakpoint to be added here specifically
  ;

export const MESSAGE_FLAG_AIX_SKIP: DMessageUserFlag = 'aix.skip';
export const MESSAGE_FLAG_STARRED: DMessageUserFlag = 'starred';
export const MESSAGE_FLAG_NOTIFY_COMPLETE: DMessageUserFlag = 'notify.complete';
export const MESSAGE_FLAG_VND_ANT_CACHE_AUTO: DMessageUserFlag = 'vnd.ant.cache.auto';
export const MESSAGE_FLAG_VND_ANT_CACHE_USER: DMessageUserFlag = 'vnd.ant.cache.user';


// Message > Generator

export type DMessageGenerator = ({
  // A named generator is a simple string, presented as-is
  mgt: 'named';
  name: 'web' | 'issue' | 'help' | string;
  // xeOpCode?: 'op-draw-text',
} | {
  // An AIX generator preserves information about original model and vendor:
  // - vendor ids will be stable across time
  // - no guarantee of consistency on the model, e.g. could be across different devices
  mgt: 'aix',
  name: string;                       // model that handled the request
  aix: {
    vId: ModelVendorId;               // Models Vendor Id (note we deleted sId, was too much, but can add it later)
    mId: DLLMId;                      // Models Id
  },
}) & {
  metrics?: DMetricsChatGenerate_Md;   // medium-sized metrics stored in the message
  providerInfraLabel?: string;         // upstream provider that served the request (e.g., OpenRouter provider routing)
  upstreamContainer?: {
    uct: 'vnd.ant.container',
    containerId: string,
    expiresAt: string,                // ISO 8601 UTC timestamp (e.g., "2026-04-07T05:59:32Z")
  },
  upstreamHandle?: {
    uht: 'vnd.oai.responses',
    responseId: string,
    expiresAt: number | null,         // null = never expires
  },
  tokenStopReason?:
    | 'client-abort'                  // if the generator stopped due to a client abort signal
    | 'filter'                        // (inline filter message injected) if the generator stopped due to a filter
    | 'issue'                         // (error fragment follows) if the generator stopped due to an issue
    | 'out-of-tokens'                 // if the generator stopped due to running out of tokens
};


// helpers - creation

export function createDMessageEmpty(role: DMessageRole) {
  return createDMessageFromFragments(role, []);
}

export function createDMessageTextContent(role: DMessageRole, text: string): DMessage {
  return createDMessageFromFragments(role, [createTextContentFragment(text)]);
}

export function createDMessagePlaceholderIncomplete(role: DMessageRole, placeholderText: string): DMessage {
  const placeholderFragment = createPlaceholderVoidFragment(placeholderText, undefined);
  const message = createDMessageFromFragments(role, [placeholderFragment]);
  message.pendingIncomplete = true;
  return message;
}

export function createDMessageFromFragments(role: DMessageRole, fragments: DMessageFragment[]): DMessage {
  return {
    id: agiUuid('chat-dmessage'),

    role: role,
    fragments,

    // pending state
    // pendingIncomplete: false,  // we leave it undefined, same as false

    // absent
    // purposeId: undefined, // @deprecated
    // metadata: undefined,
    // generator: undefined,
    // userFlags: undefined,

    // @deprecated
    tokenCount: 0,

    created: Date.now(),
    updated: null,
  };
}


// helpers - duplication

export function duplicateDMessage(message: Readonly<DMessage>, skipVoid: boolean): DMessage {
  return {
    id: agiUuid('chat-dmessage'),

    role: message.role,
    fragments: duplicateDMessageFragments(message.fragments, skipVoid), // [*] full message duplication (see downstream)

    // 2026-03-27: Not porting pendingIncomplete anymore - if a message is duplicated, we consider it detached
    // IMPORTANT: a duplicate message is never 'being generated' (anymore) - we may as well finalize it
    // ...(message.pendingIncomplete ? { pendingIncomplete: true } : {}),

    purposeId: message.purposeId,

    metadata: message.metadata ? duplicateDMessageMetadata(message.metadata) : undefined,
    generator: message.generator ? duplicateDMessageGenerator(message.generator) : undefined,
    // sessionMetadata: message.sessionMetadata ? duplicateDMessageSession(message.sessionMetadata) : undefined,
    userFlags: message.userFlags ? [...message.userFlags] : undefined,

    tokenCount: message.tokenCount,

    created: message.created,
    updated: message.updated,
  };
}

export function duplicateDMessageMetadata(metadata: Readonly<DMessageMetadata>): DMessageMetadata {
  // NOTE: update this function when adding metadata fields
  return {
    ...(metadata.inReferenceTo ? {
      inReferenceTo: metadata.inReferenceTo.map(refItem => ({ ...refItem })),
    } : {}),
    ...(metadata.entangled ? {
      entangled: { ...metadata.entangled },
    } : {}),
    ...(metadata.initialRecipients?.length ? {
      initialRecipients: metadata.initialRecipients.map(recipient => ({ ...recipient })),
    } : {}),
  };
}

export function duplicateDMessageGenerator(generator: Readonly<DMessageGenerator>): DMessageGenerator {
  switch (generator.mgt) {
    case 'named':
      return {
        mgt: 'named',
        name: generator.name,
        // ...(generator.xeOpCode ? { xeOpCode: generator.xeOpCode } : {}),
        ...(generator.metrics ? { metrics: { ...generator.metrics } } : {}),
        ...(generator.providerInfraLabel ? { providerInfraLabel: generator.providerInfraLabel } : {}),
        ...(generator.upstreamContainer ? { upstreamContainer: { ...generator.upstreamContainer } } : {}),
        ...(generator.upstreamHandle ? { upstreamHandle: { ...generator.upstreamHandle } } : {}),
        ...(generator.tokenStopReason ? { tokenStopReason: generator.tokenStopReason } : {}),
      };
    case 'aix':
      return {
        mgt: 'aix',
        name: generator.name,
        aix: { ...generator.aix },
        ...(generator.metrics ? { metrics: { ...generator.metrics } } : {}),
        ...(generator.providerInfraLabel ? { providerInfraLabel: generator.providerInfraLabel } : {}),
        ...(generator.upstreamContainer ? { upstreamContainer: { ...generator.upstreamContainer } } : {}),
        ...(generator.upstreamHandle ? { upstreamHandle: { ...generator.upstreamHandle } } : {}),
        ...(generator.tokenStopReason ? { tokenStopReason: generator.tokenStopReason } : {}),
      };
  }
}


// helpers - status checks

export function messageWasInterruptedAtStart(message: Pick<DMessage, 'generator' | 'fragments'>): boolean {
  // FIXME: placeholder-check (see below) too here?
  return message.generator?.tokenStopReason === 'client-abort' && !message.fragments?.length;
}

// export function messageOnlyContainsPlaceholder(message: Pick<DMessage, 'fragments'>): boolean {
//   return message.fragments.length === 1 && isVoidFragment(message.fragments[0]) && isPlaceholderPart(message.fragments[0].part);
// }


// helpers - generators

export function messageSetGeneratorNamed(message: Pick<DMessage, 'generator'>, label: 'web' | 'issue' | 'help' | string): void {
  message.generator = { mgt: 'named', name: label };
}

export function messageSetGeneratorAIX_AutoLabel(message: Pick<DMessage, 'generator'>, modelVendorId: ModelVendorId, modelId: DLLMId): void {
  message.generator = createGeneratorAIX_AutoLabel(modelVendorId, modelId);
}

export function createGeneratorAIX_AutoLabel(modelVendorId: ModelVendorId, modelId: DLLMId): DMessageGenerator {
  const heuristicLabel = modelId.includes('-') ? modelId.replace(/^[^-]+-(\d-)?/, '') : modelId;
  return { mgt: 'aix', name: heuristicLabel, aix: { vId: modelVendorId, mId: modelId } };
}


// helpers - user flags

const flag2EmojiMap: Record<DMessageUserFlag, string> = {
  [MESSAGE_FLAG_AIX_SKIP]: '',
  [MESSAGE_FLAG_STARRED]: '⭐️',
  [MESSAGE_FLAG_NOTIFY_COMPLETE]: '', //'🔔',
  [MESSAGE_FLAG_VND_ANT_CACHE_AUTO]: '',
  [MESSAGE_FLAG_VND_ANT_CACHE_USER]: '',
};

export function messageUserFlagToEmoji(flag: DMessageUserFlag): string {
  return flag2EmojiMap[flag] ?? '❓';
}

export function messageHasUserFlag(message: Pick<DMessage, 'userFlags'>, flag: DMessageUserFlag): boolean {
  return message.userFlags?.includes(flag) ?? false;
}

export function messageSetUserFlag(message: Pick<DMessage, 'userFlags'>, flag: DMessageUserFlag, on: boolean): DMessageUserFlag[] {
  if (on) {
    if (message.userFlags?.includes(flag))
      return message.userFlags;
    return [...(message.userFlags || []), flag];
  } else {
    if (!message.userFlags?.includes(flag))
      return message.userFlags || [];
    return (message.userFlags || []).filter(_f => _f !== flag);
  }
}


// helpers during the transition from V3

export function messageFragmentsReduceText(fragments: Immutable<DMessageFragment[]>, fragmentSeparator: string = '\n\n', excludeAttachmentFragments?: boolean): string {

  // This function is used frequently - so this is the optimized version with low allocations

  // quick path for empty fragments
  if (!fragments?.length)
    return '';

  // fast path: single text content fragment (most common case)
  if (fragments.length === 1 && fragments[0].ft === 'content' && fragments[0].part.pt === 'text')
    return fragments[0].part.text;

  // single-pass accumulation (avoids intermediate arrays from .map/.filter/.join)
  let result = '';
  for (const fragment of fragments) {
    let text: string | undefined;

    switch (fragment.ft) {
      case 'content': {
        const cPt = fragment.part.pt;
        switch (cPt) {
          case 'text':
            text = fragment.part.text;
            break;
          case 'error':
            text = fragment.part.error;
            break;
          case 'reference':
          case 'image_ref':
          case 'tool_invocation':
          case 'tool_response':
          case 'hosted_resource':
          case '_pt_sentinel':
            break;
          default:
            const _exhaustiveCheck: never = cPt;
            break;
        }
        break;
      }
      case 'attachment':
        if (!excludeAttachmentFragments) {
          const aPt = fragment.part.pt;
          switch (aPt) {
            case 'doc':
              text = fragment.part.data.text;
              break;
            case 'reference':
            case 'image_ref':
            case '_pt_sentinel':
              break;
            default:
              const _exhaustiveCheck: never = aPt;
              break;
          }
        }
        break;
      case 'void': // all void fragments (including reasoning) are ignored by definition when doing a text reduction
      case '_ft_sentinel':
        break;
      default:
        const _exhaustiveCheck: never = fragment;
        console.warn(`[DEV] messageFragmentsReduceText: unexpected '${(fragment as any)?.ft}' fragment with '${(fragment as any)?.part?.pt}' part`);
        break;
    }

    if (text) {
      if (result) result += fragmentSeparator;
      result += text;
    }
  }

  return result;
}
