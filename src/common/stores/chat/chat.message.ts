import { v4 as uuidv4 } from 'uuid';

import type { DBlobId } from '~/modules/dblobs/dblobs.types';


// Message

export interface DMessage {
  id: DMessageId;                     // unique message ID

  role: DMessageRole;
  content: DContentParts;             // multi-part content (sent: mix of text/images/etc., received: usually one part)
  userAttachments: DAttachmentPart[]; // higher-level multi-part to be sent (transformed to multipart before sending)

  // pending state (not stored)
  pendingIncomplete?: boolean;        // incomplete message (also suspends counting tokens while true)
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

  created: number;                    // created timestamp
  updated: number | null;             // updated timestamp - null means incomplete - TODO: disambiguate vs pendingIncomplete
}

export type DContentParts = DContentPart[];

export type DMessageId = string;

export type DMessageRole = 'user' | 'assistant' | 'system';


// Content Reference - we use a Ref and the DBlob framework to store media locally, or remote URLs

type DContentRef =
  | { type: 'url'; url: string } // remotely accessible URL
  | { type: 'dblob'; mimeType: string; dblobId: DBlobId } // reference to a DBlob
  ;

// type CMediaSourceInline =
//   | { type: 'base64'; mimeType: string; base64Data: string }
//   ;


// Content Part

type DContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; source: DContentRef }
  // | { type: 'audio'; mimeType: string; source: DContentRef }
  // | { type: 'video'; mimeType: string; source: DContentRef }
  // | { type: 'document'; source: DContentRef }
  | { type: 'function_call'; function: string; args: Record<string, any> }
  | { type: 'function_response'; function: string; response: Record<string, any> }
  ;


// Attachment Part

export type DAttachmentPart =
  | { type: 'atext', text: string, title?: string, collapsible: boolean }
  | { type: 'aimage', source: DContentRef, title?: string, width?: number, height?: number, collapsible: false }

// export type CAttachmentMultiPart = CAttachmentPart[];


// Metadata

export interface DMessageMetadata {
  inReplyToText?: string;           // text this was in reply to
}


// User Flags

export type DMessageUserFlag =
  | 'starred'; // user starred this


// helpers - creation

export function createDMessage(role: DMessageRole, content?: string | DContentParts): DMessage {

  // ensure content is an array
  if (content === undefined)
    content = [];
  else if (typeof content === 'string')
    content = [createTextPart(content)];
  else if (!Array.isArray(content))
    throw new Error('Invalid content');

  return {
    id: uuidv4(),

    role: role,
    content: content,
    userAttachments: [],

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

export function createTextPart(text: string): DContentPart {
  return { type: 'text', text };
}


export function duplicateDMessage(message: DMessage): DMessage {
  // TODO: deep copy of content and userAttachments?
  // there may be refs to the same DBlob, but that's fine, hopefully (they are immutable once here)
  // the dblob may need more reference count?
  return {
    id: uuidv4(),

    role: message.role,
    content: message.content.map(part => ({ ...part })),
    userAttachments: message.userAttachments.map(part => ({ ...part })),

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


// helpers - conversion

export function convertDMessage_V3_V4(message: DMessage) {

  const v3 = message as (DMessage & {
    text?: string,
    typing?: boolean
  });

  // .content
  if (!message.content || !Array.isArray(message.content)) {

    // v3.text -> v4.content
    message.content = [
      createTextPart(v3.text || ''),
    ];
    delete v3.text;

  }

  // .userAttachments
  if (!message.userAttachments?.length)
    message.userAttachments = [];

  // delete v3 fields
  delete v3.text;
  delete v3.typing;
}


// helpers - text

export function reduceContentToText(content: DContentParts): string {
  const partTextSeparator = '\n\n';
  return content.map(part => {
    if (part.type === 'text')
      return part.text;
    return '';
  }).join(partTextSeparator);
}

// TODO: this should be gone away once the port is fully done
export function singleTextOrThrow(message: DMessage): string {
  if (message.content.length !== 1)
    throw new Error('Expected single content');
  if (message.content[0].type !== 'text')
    throw new Error('Expected text content');
  return message.content[0].text;
}


// zustand-like deep replace
export function contentPartsReplaceText(content: Readonly<DContentParts>, newText: string, appendText?: boolean): DContentParts {
  // if there's no text part, append a new one
  const lastTextPart = content.findLast(part => part.type === 'text');
  if (!lastTextPart)
    return [...content, createTextPart(newText)];

  // otherwise, replace/append the text in the last text part
  return content.map(part =>
    (part === lastTextPart)
      ? { ...part, text: (appendText && part.type === 'text') ? part.text + newText : newText }
      : part,
  );
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
