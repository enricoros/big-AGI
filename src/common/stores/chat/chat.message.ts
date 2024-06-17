import type { DBlobAssetId } from '~/modules/dblobs/dblobs.types';

import { agiId, agiUuid } from '~/common/util/idUtils';


// Message

export interface DMessage {
  id: DMessageId;                     // unique message ID

  role: DMessageRole;
  fragments: DMessageFragment[];      // fragments can be content/attachments/... implicitly ordered

  // pending state (not stored)
  pendingIncomplete?: boolean;        // if true, the message is incomplete (e.g. tokens won't be computed)
  pendingPlaceholderText?: string;    // text being typed, not yet sent

  // identity
  avatar: string | null;              // image URL, or null
  sender: 'You' | 'Bot' | string;     // pretty name @deprecated

  purposeId?: string;                 // only assistant/system
  originLLM?: string;                 // only assistant - model that generated this message, goes beyond known models

  metadata?: DMessageMetadata;        // metadata, mainly at creation and for UI
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


// Message Fragments
// - mostly Parts with a purpose and extra information, with forward compatibility

export type DMessageFragment =
  | DMessageContentFragment
  | DMessageAttachmentFragment
// | DMessageBeamFragment
// | DMessageMetadataV1Fragment
  | DMessageSentinelFragment
  ;

// expected a list of one or more per message, of similar or different types
export type DMessageContentFragment = {
  ft: 'content',
  fId: DMessageFragmentId;
  part: DMessageTextPart | DMessageImageRefPart | DMessageToolCallPart | DMessageToolResponsePart | DMessagePlaceholderPart | DMessageErrorPart;
}

// displayed at the bottom of the message, zero or more
export type DMessageAttachmentFragment = {
  ft: 'attachment',
  fId: DMessageFragmentId;
  title: string;
  part: DMessageTextPart | DMessageImageRefPart;
}

// up to 1 per message, containing the Rays and Merges that would be used to restore the Beam state - could be volatile (omitted at save)
// could not be the data store itself, but only used for save/reload
// export type DMessageBeamFragment = {
//   ft: 'beam',
//   fId: DMessageFragmentId;
//   beam: { rays: any[], merges: any[], ... };
// }

// here just to foce the typesystem to work and detect corner cases
export type DMessageSentinelFragment = {
  ft: 'sentinel',
  fId: DMessageFragmentId;
  warningNoPart: boolean;
}

// this id is not unique, just 8 bytes
export type DMessageFragmentId = string;


// Message Fragment Parts
// - small and efficient (larger objects need to only be referred to)

export type DMessageTextPart = { pt: 'text', text: string };
export type DMessageImageRefPart = { pt: 'image_ref', dataRef: DMessageDataRef, altText?: string, width?: number, height?: number };
export type DMessageToolCallPart = { pt: 'tool_call', function: string, args: Record<string, any> };
export type DMessageToolResponsePart = { pt: 'tool_response', function: string, response: Record<string, any> };
export type DMessagePlaceholderPart = { pt: '..', pText: string };
export type DMessageErrorPart = { pt: 'error', error: string };


// Data Reference - we use a Ref and the DBlob framework to store media locally, or remote URLs

export type DMessageDataRef =
  | { reftype: 'url'; url: string } // remotely accessible URL
  | { reftype: 'dblob'; dblobAssetId: DBlobAssetId, mimeType: string; bytesSize: number; } // reference to a DBlob
  ;

// type DDataInline =
//   | { stype: 'base64'; mimeType: string; base64Data: string }
//   ;


// Metadata

export interface DMessageMetadata {
  inReplyToText?: string;           // text this was in reply to
}


// User Flags

export type DMessageUserFlag =
  | 'starred'; // user starred this


// helpers - creation

export function createDMessageEmpty(role: DMessageRole) {
  return createDMessageFromFragments(role, []);
}

export function createDMessageTextContent(role: DMessageRole, text: string): DMessage {
  return createDMessageFromFragments(role, [createTextContentFragment(text)]);
}

export function createDMessageFromFragments(role: DMessageRole, fragments: DMessageFragment[]): DMessage {
  return {
    id: agiUuid('chat-dmessage'),

    role: role,
    fragments,

    // pending state
    // pendingIncomplete: false,
    // pendingPlaceholderText: undefined,

    // identity
    avatar: null,
    sender: role === 'user' ? 'You' : 'Bot',

    // absent
    // purposeId: undefined,
    // originLLM: undefined,
    // metadata: undefined,
    // userFlags: undefined,

    // @deprecated
    tokenCount: 0,

    created: Date.now(),
    updated: null,
  };
}

export function pendDMessage(message: DMessage, placeholderText?: string): DMessage {
  message.pendingIncomplete = true;
  if (placeholderText)
    message.pendingPlaceholderText = placeholderText;
  else
    delete message.pendingPlaceholderText;
  return message;
}


// fragments - each message has fragments (zero or more) each of a single type and with a single part

export function createTextContentFragment(text: string): DMessageContentFragment {
  return createContentFragment(createDMessageTextPart(text));
}

export function createImageContentFragment(dataRef: DMessageDataRef, altText?: string, width?: number, height?: number): DMessageContentFragment {
  return createContentFragment(createDMessageImagePart(dataRef, altText, width, height));
}

export function createPlaceholderContentFragment(placeholderText: string): DMessageContentFragment {
  return createContentFragment(createDMessagePlaceholderPart(placeholderText));
}

export function createErrorContentFragment(error: string): DMessageContentFragment {
  return createContentFragment(createDMessageErrorPart(error));
}

function createContentFragment(part: DMessageContentFragment['part']): DMessageContentFragment {
  return { ft: 'content', fId: agiId('chat-dfragment'), part };
}


export function createTextAttachmentFragment(text: string, title: string): DMessageAttachmentFragment {
  return createAttachmentFragment(title, createDMessageTextPart(text));
}

export function createImageAttachmentFragment(title: string, dataRef: DMessageDataRef, altText?: string, width?: number, height?: number): DMessageAttachmentFragment {
  return createAttachmentFragment(title, createDMessageImagePart(dataRef, altText, width, height));
}

export function createAttachmentFragment(title: string, part: DMessageAttachmentFragment['part']): DMessageAttachmentFragment {
  return { ft: 'attachment', fId: agiId('chat-dfragment'), title, part };
}


function createSentinelFragment(justAnOption: boolean): DMessageSentinelFragment {
  return { ft: 'sentinel', fId: agiId('chat-dfragment'), warningNoPart: justAnOption };
}


// parts - each fragment has a part

function createDMessageTextPart(text: string): DMessageTextPart {
  return { pt: 'text', text };
}

function createDMessageImagePart(dataRef: DMessageDataRef, altText?: string, width?: number, height?: number): DMessageImageRefPart {
  return { pt: 'image_ref', dataRef, altText, width, height };
}

function createDMessageToolCallPart(functionName: string, args: Record<string, any>): DMessageToolCallPart {
  return { pt: 'tool_call', function: functionName, args };
}

function createDMessageToolResponsePart(functionName: string, response: Record<string, any>): DMessageToolResponsePart {
  return { pt: 'tool_response', function: functionName, response };
}

function createDMessagePlaceholderPart(placeholderText: string): DMessagePlaceholderPart {
  return { pt: '..', pText: placeholderText };
}

function createDMessageErrorPart(error: string): DMessageErrorPart {
  return { pt: 'error', error };
}

// data references

export function createDMessageDataRefUrl(url: string): DMessageDataRef {
  return { reftype: 'url', url };
}

export function createDMessageDataRefDBlob(dblobAssetId: DBlobAssetId, mimeType: string, bytesSize: number): DMessageDataRef {
  return { reftype: 'dblob', dblobAssetId: dblobAssetId, mimeType, bytesSize };
}


// helpers - duplication

export function duplicateDMessage(message: Readonly<DMessage>): DMessage {
  return {
    id: agiUuid('chat-dmessage'),

    role: message.role,
    fragments: duplicateDMessageFragments(message.fragments),

    ...(message.pendingIncomplete ? { pendingIncomplete: true } : {}),
    ...(message.pendingPlaceholderText ? { pendingPlaceholderText: message.pendingPlaceholderText } : {}),

    avatar: message.avatar,
    sender: message.sender,

    purposeId: message.purposeId,
    originLLM: message.originLLM,
    metadata: message.metadata ? { ...message.metadata } : undefined,
    userFlags: message.userFlags ? [...message.userFlags] : undefined,

    tokenCount: message.tokenCount,

    created: message.created,
    updated: message.updated,
  };
}

export function duplicateDMessageFragments(fragments: Readonly<DMessageFragment[]>): DMessageFragment[] {
  return fragments.map(_duplicateFragment);
}

function _duplicateFragment(fragment: DMessageFragment): DMessageFragment {
  switch (fragment.ft) {
    case 'content':
      return createContentFragment(_duplicatePart(fragment.part));

    case 'attachment':
      return createAttachmentFragment(fragment.title, _duplicatePart(fragment.part));

    case 'sentinel':
      return createSentinelFragment(fragment.warningNoPart);

    // default:
    //   throw new Error('Invalid fragment');
  }
}

function _duplicatePart<T extends (DMessageContentFragment | DMessageAttachmentFragment)['part']>(part: T): T {
  switch (part.pt) {
    case 'text':
      return createDMessageTextPart(part.text) as T;

    case 'image_ref':
      return createDMessageImagePart(_duplicateReference(part.dataRef), part.altText, part.width, part.height) as T;

    case 'tool_call':
      return createDMessageToolCallPart(part.function, { ...part.args }) as T;

    case 'tool_response':
      return createDMessageToolResponsePart(part.function, { ...part.response }) as T;

    case '..':
      return createDMessagePlaceholderPart(part.pText) as T;

    case 'error':
      return createDMessageErrorPart(part.error) as T;

    // default:
    //   throw new Error('Invalid part');
  }
}

function _duplicateReference(ref: DMessageDataRef): DMessageDataRef {
  switch (ref.reftype) {
    case 'url':
      return createDMessageDataRefUrl(ref.url);

    case 'dblob':
      return createDMessageDataRefDBlob(ref.dblobAssetId, ref.mimeType, ref.bytesSize);

    // default: // unreachable, we'd get a compiler error before this
    //   throw new Error('Invalid reference');
  }
}


// helpers during the transition from V3

export function isContentFragment(fragment: DMessageFragment): fragment is DMessageContentFragment {
  return fragment.ft === 'content';
}

export function isContentOrAttachmentFragment(fragment: DMessageFragment): fragment is DMessageContentFragment | DMessageAttachmentFragment {
  return fragment.ft === 'content' || fragment.ft === 'attachment';
}

export function messageFragmentsReduceText(fragments: DMessageFragment[], fragmentSeparator: string = '\n\n'): string {
  return fragments
    .map(fragment => (isContentOrAttachmentFragment(fragment) && fragment.part.pt === 'text') ? fragment.part.text : '')
    .filter(text => !!text)
    .join(fragmentSeparator);
}

export function messageFragmentsReplaceLastContentText(fragments: Readonly<DMessageFragment[]>, newText: string, appendText?: boolean): DMessageFragment[] {

  // if there's no text fragment, create it
  const lastTextFragment = fragments.findLast(f => f.ft === 'content' && f.part.pt === 'text') as DMessageContentFragment | undefined;
  if (!lastTextFragment)
    return [...fragments, createTextContentFragment(newText)];

  // append/replace the last text fragment
  return fragments.map(fragment =>
    (fragment === lastTextFragment)
      ? { ...fragment, part: createDMessageTextPart((appendText && fragment.part.pt === 'text') ? fragment.part.text + newText : newText) }
      : fragment,
  );
}

// TODO: remove once the port is fully done
export function messageSingleTextOrThrow(message: DMessage): string {
  if (message.fragments.length !== 1)
    throw new Error('Expected single fragment');
  if (!isContentOrAttachmentFragment(message.fragments[0]))
    throw new Error('Expected a content or attachment fragment');
  if (message.fragments[0].part.pt !== 'text')
    throw new Error('Expected a text part');
  return message.fragments[0].part.text;
}


// helpers - user flags

const flag2EmojiMap: Record<DMessageUserFlag, string> = {
  starred: '⭐️',
};

export function messageUserFlagToEmoji(flag: DMessageUserFlag): string {
  return flag2EmojiMap[flag] || '❓';
}

export function messageHasUserFlag(message: DMessage, flag: DMessageUserFlag): boolean {
  return message.userFlags?.includes(flag) ?? false;
}

export function messageToggleUserFlag(message: DMessage, flag: DMessageUserFlag): DMessageUserFlag[] {
  if (message.userFlags?.includes(flag))
    return message.userFlags.filter(_f => _f !== flag);
  else
    return [...(message.userFlags || []), flag];
}

export function messageHasImageFragments(message: DMessage): boolean {
  return message.fragments.some(fragment => isContentOrAttachmentFragment(fragment) && fragment.part.pt === 'image_ref' /*&& fragment.part.dataRef.reftype === 'dblob'*/);
}