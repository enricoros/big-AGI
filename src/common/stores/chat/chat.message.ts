import { agiUuid } from '~/common/util/idUtils';
import { createPlaceholderMetaFragment, createTextContentFragment, DMessageContentFragment, DMessageFragment, duplicateDMessageFragments, isAttachmentFragment, isContentFragment, isContentOrAttachmentFragment, isTextPart, specialShallowReplaceTextContentFragment } from '~/common/stores/chat/chat.fragments';


// Message

export interface DMessage {
  id: DMessageId;                     // unique message ID

  role: DMessageRole;
  fragments: DMessageFragment[];      // fragments can be content/attachments/... implicitly ordered

  // pending state (not stored)
  pendingIncomplete?: boolean;        // if true, the message is incomplete (e.g. tokens won't be computed)

  // identity
  avatar: string | null;              // image URL, or null

  // TODO: @deprecated - move to a Persona ID of the persona who wrote it, and still, could be teamwork...
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

export function createDMessagePlaceholderIncomplete(role: DMessageRole, placeholderText: string): DMessage {
  const placeholderFragment = createPlaceholderMetaFragment(placeholderText);
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

    // identity
    avatar: null,

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


// helpers - duplication

export function duplicateDMessage(message: Readonly<DMessage>): DMessage {
  return {
    id: agiUuid('chat-dmessage'),

    role: message.role,
    fragments: duplicateDMessageFragments(message.fragments),

    ...(message.pendingIncomplete ? { pendingIncomplete: true } : {}),

    avatar: message.avatar,

    purposeId: message.purposeId,
    originLLM: message.originLLM,
    metadata: message.metadata ? duplicateDMessageMetadata(message.metadata) : undefined,
    userFlags: message.userFlags ? [...message.userFlags] : undefined,

    tokenCount: message.tokenCount,

    created: message.created,
    updated: message.updated,
  };
}

export function duplicateDMessageMetadata(metadata: Readonly<DMessageMetadata>): DMessageMetadata {
  // TODO: deep copy this?
  return { ...metadata };
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


// helpers during the transition from V3

export function messageFragmentsReduceText(fragments: DMessageFragment[], fragmentSeparator: string = '\n\n'): string {

  return fragments
    .map(fragment => {
      if (isContentFragment(fragment)) {
        switch (fragment.part.pt) {
          case 'text':
            return fragment.part.text;
          case 'error':
            return fragment.part.error;
          case 'image_ref':
            return '';
          case 'ph':
            return '';
          // ignore tools
          case 'tool_invocation':
          case 'tool_response':
            return '';
        }
      } else if (isAttachmentFragment(fragment)) {
        switch (fragment.part.pt) {
          case 'doc':
            return fragment.part.data.text;
          case 'image_ref':
            return '';
        }
      }
      console.warn(`DEV: messageFragmentsReduceText: unexpected '${fragment.ft}' fragment with '${(fragment as any)?.part?.pt}' part`);
      return '';
    })
    .filter(text => !!text)
    .join(fragmentSeparator);
}

export function messageFragmentsReplaceLastContentText(fragments: Readonly<DMessageFragment[]>, newText: string, appendText?: boolean): DMessageFragment[] {

  // if there's no text fragment, create it
  const lastTextFragment = fragments.findLast(f => isContentFragment(f) && isTextPart(f.part)) as DMessageContentFragment | undefined;
  if (!lastTextFragment)
    return [...fragments, createTextContentFragment(newText)];

  // append/replace the last text fragment
  return fragments.map(fragment =>
    (fragment === lastTextFragment)
      ? specialShallowReplaceTextContentFragment(lastTextFragment, (appendText && isTextPart(lastTextFragment.part)) ? lastTextFragment.part.text + newText : newText)
      : fragment,
  );
}

// TODO: remove once the port is fully done - at 2.0.0 ?
export function messageSingleTextOrThrow(message: DMessage): string {
  if (message.fragments.length !== 1)
    throw new Error('Expected single fragment');
  if (!isContentOrAttachmentFragment(message.fragments[0]))
    throw new Error('Expected a content or attachment fragment');
  if (message.fragments[0].part.pt !== 'text')
    throw new Error('Expected a text part');
  return message.fragments[0].part.text;
}
