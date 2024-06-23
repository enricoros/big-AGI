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
  ft: 'content',
  fId: DMessageFragmentId;
  part:
    | DMessageTextPart
    | DMessageImageRefPart
    | DMessageToolCallPart
    | DMessageToolResponsePart
    | DMessagePlaceholderPart
    | DMessageErrorPart
    | _DMessageSentinelPart;
}

// displayed at the bottom of the message, zero or more
export type DMessageAttachmentFragment = {
  ft: 'attachment',
  fId: DMessageFragmentId;
  title: string;
  part:
    | DMessageTextPart
    | DMessageImageRefPart
    | _DMessageSentinelPart;
}

// force the typesystem to work, bark, and detect/reveal corner cases
type _DMessageSentinelFragment = {
  ft: '_ft_sentinel',
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

export type DMessageTextPart = { pt: 'text', text: string };
export type DMessageImageRefPart = { pt: 'image_ref', dataRef: DMessageDataRef, altText?: string, width?: number, height?: number };
export type DMessageToolCallPart = { pt: 'tool_call', function: string, args: Record<string, any> };
export type DMessageToolResponsePart = { pt: 'tool_response', function: string, response: Record<string, any> };
export type DMessagePlaceholderPart = { pt: 'ph', pText: string };
export type DMessageErrorPart = { pt: 'error', error: string };
type _DMessageSentinelPart = { pt: '_pt_sentinel' };


//
// Message Data Reference
//
// We use a Ref and the DBlob framework to store media locally, or remote URLs
//

export type DMessageDataRef =
  | { reftype: 'url'; url: string } // remotely accessible URL - NOTE: not used right now, this is more of a sentinel
  | { reftype: 'dblob'; dblobAssetId: DBlobAssetId, mimeType: string; bytesSize: number; } // reference to a DBlob
  ;

// type DDataInline =
//   | { stype: 'base64'; mimeType: string; base64Data: string }
//   ;


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


/// Helpers - Fragments Creation

export function createTextContentFragment(text: string): DMessageContentFragment {
  return _createContentFragment(createDMessageTextPart(text));
}

export function createTextContentOverFragment(copyFragment: DMessageContentFragment, text: string): DMessageContentFragment {
  return { ...copyFragment, part: createDMessageTextPart(text) };
}

export function createImageContentFragment(dataRef: DMessageDataRef, altText?: string, width?: number, height?: number): DMessageContentFragment {
  return _createContentFragment(createDMessageImagePart(dataRef, altText, width, height));
}

export function createPlaceholderContentFragment(placeholderText: string): DMessageContentFragment {
  return _createContentFragment(createDMessagePlaceholderPart(placeholderText));
}

export function createErrorContentFragment(error: string): DMessageContentFragment {
  return _createContentFragment(createDMessageErrorPart(error));
}


export function createTextAttachmentFragment(title: string, text: string): DMessageAttachmentFragment {
  return _createAttachmentFragment(title, createDMessageTextPart(text));
}

export function createImageAttachmentFragment(title: string, dataRef: DMessageDataRef, altText?: string, width?: number, height?: number): DMessageAttachmentFragment {
  return _createAttachmentFragment(title, createDMessageImagePart(dataRef, altText, width, height));
}

export function createContentPartAttachmentFragment(title: string, part: DMessageContentFragment['part']): DMessageAttachmentFragment {
  if (part.pt === 'text' || part.pt === 'image_ref' || part.pt === '_pt_sentinel')
    return _createAttachmentFragment(title, _duplicatePart(part));
  return createTextAttachmentFragment(title, `Attaching a message with content part '${part.pt}' is not supported yet.`);
}


function _createContentFragment(part: DMessageContentFragment['part']): DMessageContentFragment {
  return { ft: 'content', fId: agiId('chat-dfragment' /* -content */), part };
}

function _createAttachmentFragment(title: string, part: DMessageAttachmentFragment['part']): DMessageAttachmentFragment {
  return { ft: 'attachment', fId: agiId('chat-dfragment' /* -attachment */), title, part };
}

function _createSentinelFragment(): _DMessageSentinelFragment {
  return { ft: '_ft_sentinel', fId: agiId('chat-dfragment' /* -_sentinel */) };
}


/// Helpers - Parts Creation

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
  return { pt: 'ph', pText: placeholderText };
}

function createDMessageErrorPart(error: string): DMessageErrorPart {
  return { pt: 'error', error };
}

function createSentinelPart(): _DMessageSentinelPart {
  return { pt: '_pt_sentinel' };
}


/// Helpers - Data Reference Creation

export function createDMessageDataRefUrl(url: string): DMessageDataRef {
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
      return _createAttachmentFragment(fragment.title, _duplicatePart(fragment.part));

    case '_ft_sentinel':
      return _createSentinelFragment();

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

    case 'ph':
      return createDMessagePlaceholderPart(part.pText) as T;

    case 'error':
      return createDMessageErrorPart(part.error) as T;

    case '_pt_sentinel':
      return createSentinelPart() as T;

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
