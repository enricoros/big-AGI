import type { DBlobAssetId } from '~/modules/dblobs/dblobs.types';

import { agiId } from '~/common/util/idUtils';


//
// Message Fragments - forward compatible
//
// The Message Fragment is the smallest unit of a message, and can be of different types.
// A Fragment decorates a 'Part' with a type discriminator end extra information (like a title).
//
// Notes:
// - fId: Fragment ID (8 bytes), unique within the container only
//

export type DMessageFragmentId = string; // not unique, 8 bytes

export type DMessageFragment =
  | DMessageContentFragment
  | DMessageAttachmentFragment
  // | DMessageBeamFragment
  | _DMessageSentinelFragment;


// expected a list of one or more per message, of similar or different types
export type DMessageContentFragment = {
  ft: 'content';
  fId: DMessageFragmentId;
  part:
    | DMessageErrorPart         // red message, e.g. non-content application issues
    | DMessageImageRefPart      // large image
    | DMessagePlaceholderPart   // (non submitted) placeholder to be replaced by another part
    | DMessageTextPart          // plain text or mixed content -> BlockRenderer
    | DMessageToolCallPart      // shown to dev only, singature of the llm function call
    | DMessageToolResponsePart  // shown to dev only, response of the llm
    | _DMessageSentinelPart;
};

// displayed at the bottom of the message, zero or more
export type DMessageAttachmentFragment = {
  ft: 'attachment';
  fId: DMessageFragmentId;
  title: string;                // label of the attachment (filename, named id, content overview, title..)
  caption: string;              // additional information, such as provenance, content preview, etc.
  created: number;
  part:
    | DMessageDocPart
    | DMessageImageRefPart
    | _DMessageSentinelPart;
};

// force the typesystem to work, bark, and detect/reveal corner cases
type _DMessageSentinelFragment = {
  ft: '_ft_sentinel';
  fId: DMessageFragmentId;
}

// Future Examples: up to 1 per message, containing the Rays and Merges that would be used to restore the Beam state - could be volatile (omitted at save)
// could not be the data store itself, but only used for save/reload
// export type DMessageBeamFragment = {
//   ft: 'beam',
//   fId: DMessageFragmentId;
//   beam: { rays: any[], merges: any[], ... };
// }


//
// Message Parts
//
// Small and efficient (larger objects need to only be referred to)
//

export type DMessageDocPart = { pt: 'doc', type: DMessageDocMimeType, data: DMessageDataInline, ref: string, meta?: DMessageDocMeta };
export type DMessageErrorPart = { pt: 'error', error: string };
export type DMessageImageRefPart = { pt: 'image_ref', dataRef: DMessageDataRef, altText?: string, width?: number, height?: number };
export type DMessagePlaceholderPart = { pt: 'ph', pText: string };
export type DMessageTextPart = { pt: 'text', text: string };
export type DMessageToolCallPart = { pt: 'tool_call', function: string, args: Record<string, any> };
export type DMessageToolResponsePart = { pt: 'tool_response', function: string, response: Record<string, any> };
type _DMessageSentinelPart = { pt: '_pt_sentinel' };


type DMessageDocMimeType =
  | 'application/vnd.agi.ego'         // for attaching messages
  // | 'application/vnd.agi.code'        // Blocks > RenderCode
  // | 'application/vnd.agi.imageRef'    // for image attachments with da - NO: makes no sense, as doc contains data
  | 'application/vnd.agi.ocr'         // images/pdfs converted as text
  // | 'application/vnd.agi.plantuml'
  // | 'image/svg+xml'
  // | 'text/csv'                        // table editor
  | 'text/html'                       // can be rendered in iframes (RenderCode[HTML])
  | 'text/markdown'                   // can be rendered as markdown (note that text/plain can also)
  | 'text/plain'                      // e.g. clipboard paste
  ;

type DMessageDocMeta = {
  codeLanguage?: string;
  srcFileName?: string;
  srcFileSize?: number;
  srcOcrFrom?: 'image' | 'pdf';
}


//
// Message Data Reference
//
// We use a Ref and the DBlob framework to store media locally, or remote URLs
//

export type DMessageDataInline =
  | { idt: 'text', text: string, mimeType?: string /* optional, assuming the upper layers have mime already */ }; // | { idt: 'base64', base64: string };

export type DMessageDataRef =
  | { reftype: 'url'; url: string } // remotely accessible URL - NOTE: not used right now, this is more of a sentinel
  | { reftype: 'dblob'; dblobAssetId: DBlobAssetId, mimeType: string; bytesSize: number; } // reference to a DBlob
  ;


/// Helpers - Fragment Type Guards - (we don't need 'fragment is X' since TypeScript 5.5.2)

export function isContentFragment(fragment: DMessageFragment) {
  return fragment.ft === 'content';
}

export function isAttachmentFragment(fragment: DMessageFragment) {
  return fragment.ft === 'attachment';
}

export function isContentOrAttachmentFragment(fragment: DMessageFragment) {
  return fragment.ft === 'content' || fragment.ft === 'attachment';
}

export function isDocPart(part: DMessageContentFragment['part'] | DMessageAttachmentFragment['part']) {
  return part.pt === 'doc';
}

export function isImageRefPart(part: DMessageContentFragment['part'] | DMessageAttachmentFragment['part']) {
  return part.pt === 'image_ref';
}

export function isTextPart(part: DMessageContentFragment['part']) {
  return part.pt === 'text';
}


/// Helpers - Fragments Creation

function _createContentFragment(part: DMessageContentFragment['part']): DMessageContentFragment {
  return { ft: 'content', fId: agiId('chat-dfragment' /* -content */), part };
}

export function createErrorContentFragment(error: string): DMessageContentFragment {
  return _createContentFragment(createDMessageErrorPart(error));
}

export function createImageContentFragment(dataRef: DMessageDataRef, altText?: string, width?: number, height?: number): DMessageContentFragment {
  return _createContentFragment(createDMessageImageRefPart(dataRef, altText, width, height));
}

export function createPlaceholderContentFragment(placeholderText: string): DMessageContentFragment {
  return _createContentFragment(createDMessagePlaceholderPart(placeholderText));
}

export function createTextContentFragment(text: string): DMessageContentFragment {
  return _createContentFragment(createDMessageTextPart(text));
}

export function specialShallowReplaceTextContentFragment(copyFragment: DMessageContentFragment, text: string): DMessageContentFragment {
  return { ...copyFragment, part: createDMessageTextPart(text) };
}


function _createAttachmentFragment(title: string, caption: string, part: DMessageAttachmentFragment['part']): DMessageAttachmentFragment {
  return { ft: 'attachment', fId: agiId('chat-dfragment' /* -attachment */), title, caption, created: Date.now(), part };
}

export function createDocAttachmentFragment(title: string, caption: string, type: DMessageDocMimeType, data: DMessageDataInline, ref: string, meta?: DMessageDocMeta): DMessageAttachmentFragment {
  return _createAttachmentFragment(title, caption, createDMessageDocPart(type, data, ref, meta));
}

export function createImageAttachmentFragment(title: string, caption: string, dataRef: DMessageDataRef, imgAltText?: string, width?: number, height?: number): DMessageAttachmentFragment {
  return _createAttachmentFragment(title, caption, createDMessageImageRefPart(dataRef, imgAltText, width, height));
}

export function specialContentPartToDocAttachmentFragment(title: string, caption: string, contentPart: DMessageContentFragment['part'], ref: string, docMeta?: DMessageDocMeta): DMessageAttachmentFragment {
  if (isTextPart(contentPart))
    return createDocAttachmentFragment(title, caption, 'text/plain', createDMessageDataInlineText(contentPart.text), ref, docMeta);
  if (isImageRefPart(contentPart))
    return createImageAttachmentFragment(title, caption, _duplicateDataReference(contentPart.dataRef), contentPart.altText, contentPart.width, contentPart.height);
  return createDocAttachmentFragment('Error', 'Content to Attachment', 'text/plain', createDMessageDataInlineText(`Conversion of '${contentPart.pt}' is not supported yet.`), ref, docMeta);
}


function _createSentinelFragment(): _DMessageSentinelFragment {
  return { ft: '_ft_sentinel', fId: agiId('chat-dfragment' /* -_sentinel */) };
}


/// Helpers - Parts Creation

function createDMessageDocPart(type: DMessageDocMimeType, data: DMessageDataInline, ref: string, meta?: DMessageDocMeta): DMessageDocPart {
  return { pt: 'doc', type, data, ref, meta };
}

function createDMessageErrorPart(error: string): DMessageErrorPart {
  return { pt: 'error', error };
}

function createDMessageImageRefPart(dataRef: DMessageDataRef, altText?: string, width?: number, height?: number): DMessageImageRefPart {
  return { pt: 'image_ref', dataRef, altText, width, height };
}

function createDMessagePlaceholderPart(placeholderText: string): DMessagePlaceholderPart {
  return { pt: 'ph', pText: placeholderText };
}

function createDMessageTextPart(text: string): DMessageTextPart {
  return { pt: 'text', text };
}

function createDMessageToolCallPart(functionName: string, args: Record<string, any>): DMessageToolCallPart {
  return { pt: 'tool_call', function: functionName, args };
}

function createDMessageToolResponsePart(functionName: string, response: Record<string, any>): DMessageToolResponsePart {
  return { pt: 'tool_response', function: functionName, response };
}

function createDMessageSentinelPart(): _DMessageSentinelPart {
  return { pt: '_pt_sentinel' };
}


/// Helpers - Data Reference Creation

export function createDMessageDataInlineText(text: string, mimeType?: string): DMessageDataInline {
  return { idt: 'text', text, mimeType };
}

function createDMessageDataRefUrl(url: string): DMessageDataRef {
  return { reftype: 'url', url };
}

export function createDMessageDataRefDBlob(dblobAssetId: DBlobAssetId, mimeType: string, bytesSize: number): DMessageDataRef {
  return { reftype: 'dblob', dblobAssetId: dblobAssetId, mimeType, bytesSize };
}


/// Helpers - Duplication

export function duplicateDMessageFragments(fragments: Readonly<DMessageFragment[]>): DMessageFragment[] {
  return fragments.map(_duplicateFragment);
}

function _duplicateFragment(fragment: DMessageFragment): DMessageFragment {
  switch (fragment.ft) {
    case 'content':
      return _createContentFragment(_duplicatePart(fragment.part));

    case 'attachment':
      return _createAttachmentFragment(fragment.title, fragment.caption, _duplicatePart(fragment.part));

    case '_ft_sentinel':
      return _createSentinelFragment();

    // default:
    //   throw new Error('Invalid fragment');
  }
}

function _duplicatePart<TPart extends (DMessageContentFragment | DMessageAttachmentFragment)['part']>(part: TPart): TPart {
  switch (part.pt) {
    case 'doc':
      return createDMessageDocPart(part.type, _duplicateInlineData(part.data), part.ref, part.meta) as TPart;

    case 'error':
      return createDMessageErrorPart(part.error) as TPart;

    case 'image_ref':
      return createDMessageImageRefPart(_duplicateDataReference(part.dataRef), part.altText, part.width, part.height) as TPart;

    case 'ph':
      return createDMessagePlaceholderPart(part.pText) as TPart;

    case 'text':
      return createDMessageTextPart(part.text) as TPart;

    case 'tool_call':
      return createDMessageToolCallPart(part.function, _duplicateObjectWarning(part.args, 'tool_call')) as TPart;

    case 'tool_response':
      return createDMessageToolResponsePart(part.function, _duplicateObjectWarning(part.response, 'tool_response')) as TPart;

    case '_pt_sentinel':
      return createDMessageSentinelPart() as TPart;
  }
}

function _duplicateInlineData(data: DMessageDataInline): DMessageDataInline {
  switch (data.idt) {
    case 'text':
      return createDMessageDataInlineText(data.text, data.mimeType);

    // case 'base64':
    //   return createDMessageDataInlineBase64(data.base64);
  }
}

function _duplicateDataReference(ref: DMessageDataRef): DMessageDataRef {
  switch (ref.reftype) {
    case 'url':
      return createDMessageDataRefUrl(ref.url);

    case 'dblob':
      return createDMessageDataRefDBlob(ref.dblobAssetId, ref.mimeType, ref.bytesSize);
  }
}

function _duplicateObjectWarning<T extends Record<string, any>>(obj: T, devPlace: string): T {
  console.warn('[DEV]: implement deep copy for:', devPlace);
  return { ...obj };
}
