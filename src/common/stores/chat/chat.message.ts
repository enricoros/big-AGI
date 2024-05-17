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
  | { reftype: 'url'; url: string } // remotely accessible URL
  | { reftype: 'dblob'; mimeType: string; dblobId: DBlobId } // reference to a DBlob
  ;

// type CMediaSourceInline =
//   | { stype: 'base64'; mimeType: string; base64Data: string }
//   ;


// Content Part - this gets saved to the slow DB - needs to be small and efficient

type DContentPart =
  | { ptype: 'text'; text: string } // H/A
  | { ptype: 'image'; mimeType: string; source: DContentRef }
  // | { ptype: 'audio'; mimeType: string; source: DContentRef }
  // | { ptype: 'video'; mimeType: string; source: DContentRef }
  // | { ptype: 'document'; source: DContentRef } // H
  | { ptype: 'function_call'; function: string; args: Record<string, any> } // A
  | { ptype: 'function_response'; function: string; response: Record<string, any> } // A
  ;


// Attachment Part

export type DAttachmentPart =
  | { atype: 'atext', text: string, title?: string, collapsible: boolean }
  | { atype: 'aimage', source: DContentRef, title?: string, width?: number, height?: number, collapsible: false }

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
  return { ptype: 'text', text: text };
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


// helpers - content parts

export function reduceContentToText(content: DContentParts, textPartSeparator: string = '\n\n'): string {
  return content.map(part => {
    if (part.ptype === 'text')
      return part.text;
    return '';
  }).filter(text => !!text).join(textPartSeparator);
}

// TODO: this should be gone away once the port is fully done
export function singleTextOrThrow(message: DMessage): string {
  if (message.content.length !== 1)
    throw new Error('Expected single content');
  if (message.content[0].ptype !== 'text')
    throw new Error('Expected text content');
  return message.content[0].text;
}


// zustand-like deep replace
export function contentPartsReplaceText(content: Readonly<DContentParts>, newText: string, appendText?: boolean): DContentParts {
  // if there's no text part, append a new one
  const lastTextPart = content.findLast(part => part.ptype === 'text');
  if (!lastTextPart)
    return [...content, createTextPart(newText)];

  // otherwise, replace/append the text in the last text part
  return content.map(part =>
    (part === lastTextPart)
      ? { ...part, text: (appendText && part.ptype === 'text') ? part.text + newText : newText }
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
