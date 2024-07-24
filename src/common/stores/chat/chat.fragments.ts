import type { DBlobAssetId } from '~/modules/dblobs/dblobs.types';

import type { LiveFileId } from '~/common/livefile/liveFile.types';
import { agiId } from '~/common/util/idUtils';


/// Fragments - forward compatible ///

// The Message Fragment is the smallest unit of a message, and can be of different types that wrap
// a 'Part' with a type discriminator and extra information (like a title). Notes:
// - fId: Fragment ID (8 bytes), unique within the container only

/*export type DSystemInstructionFragment = DMessageBaseFragment<'system',
  | DMessageTextPart
> & {
  // UI attributes for a great system message, e.g. has it been edited, etc.
  editable?: boolean;
  deletable?: boolean;
  modified?: boolean;
};*/

export type DMessageFragment =
  | DMessageContentFragment
  | DMessageAttachmentFragment
  // | DMessageBeamFragment
  | _DMessageSentinelFragment
  ;

// Content: real signal, needs to be sent to the llm
export type DMessageContentFragment = _DMessageFragmentWrapper<'content',
  | DMessageTextPart              // plain text or mixed content -> BlockRenderer
  | DMessageImageRefPart          // large image
  | DMessageToolInvocationPart    // shown to dev only, singature of the llm function call
  | DMessageToolResponsePart      // shown to dev only, response of the llm
  | DMessageErrorPart             // red message, e.g. non-content application issues
  | DMetaPlaceholderPart          // (non submitted) placeholder to be replaced by another part
  | _DMetaSentinelPart
>;

// Attachments: labeled docs or images, output of Composer > Attachments
export type DMessageAttachmentFragment = _DMessageFragmentWrapper<'attachment',
  | DMessageDocPart               // document Attachment
  | DMessageImageRefPart          // image Attachment
  | _DMetaSentinelPart
> & {
  title: string;                  // label of the attachment (filename, named id, content overview, title..)
  caption: string;                // additional information, such as provenance, content preview, etc.
  created: number;
  liveFileId?: LiveFileId;        // [LiveFile] Optional. Relate to a LiveFile; if present, it may still be invalid, hence we cleanup on load
};

// Future Examples: up to 1 per message, containing the Rays and Merges that would be used to restore the Beam state - could be volatile (omitted at save)
// could not be the data store itself, but only used for save/reload
// export type DMessageBeamFragment = DMessageBaseFragment<'beam'> & {
//   ft: 'beam',
//   fId: DMessageFragmentId;
//   beam: { rays: any[], merges: any[], ... };
// }

// Sentinel: force the typesystem to work, bark, and detect/reveal corner cases - unused aside from revealing fragment type issues
type _DMessageSentinelFragment = { ft: '_ft_sentinel', fId: DMessageFragmentId };

export type DMessageFragmentId = string; // not unique, 8 bytes
type _DMessageFragmentWrapper<TFragment, TPart extends { pt: string }> = {
  ft: TFragment;
  fId: DMessageFragmentId;
  part: TPart;
}


/// Parts - STABLE ///

// - Data at rest: these are used in the DMessage objects
// - DO NOT CHANGE - think twice (data at rest)
// Small and efficient (larger objects need to only be referred to)

export type DMessageTextPart = { pt: 'text', text: string };

export type DMessageImageRefPart = { pt: 'image_ref', dataRef: DMessageDataRef, altText?: string, width?: number, height?: number };

export type DMessageDocPart = { pt: 'doc', type: DMessageDocMimeType, data: DMessageDataInline, ref: string, l1Title: string, meta?: DMessageDocMeta };
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

export type DMessageToolInvocationPart = { pt: 'tool_call', id: string, call: DMessageToolInvocationFunctionCall | DMessageToolInvocationCodeExecution };
type DMessageToolInvocationFunctionCall = {
  type: 'function_call'
  name: string;             // Name of the function as passed from the definition
  args: string | null;      // JSON-encoded, if null there are no args
  _description?: string;    // Description from the definition
  _args_schema?: object;    // JSON Schema { type: 'object', properties: { ... } } from the definition
};
type DMessageToolInvocationCodeExecution = {
  type: 'code_execution';
  variant?: 'gemini_auto_inline';
  language?: string;
  code: string;
};

export type DMessageToolResponsePart = { pt: 'tool_response', id: string, response: DMessageToolResponseFunctionCall | DMessageToolResponseCodeExecution, error?: boolean | string, _environment?: DMessageToolEnvironment };
type DMessageToolResponseFunctionCall = {
  type: 'function_call';
  result: string;           // The output
  _name?: string;           // Name of the function that produced the result
};
type DMessageToolResponseCodeExecution = {
  type: 'code_execution';
  result: string;           // The output
  _variant?: 'gemini_auto_inline';
};
type DMessageToolEnvironment = 'upstream' | 'server' | 'client';

export type DMessageErrorPart = { pt: 'error', error: string };

export type DMetaPlaceholderPart = { pt: 'ph', pText: string };

type _DMetaSentinelPart = { pt: '_pt_sentinel' };


//
// Message Data - DO NOT CHANGE - think twice (data at rest)
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

export function createPlaceholderMetaFragment(placeholderText: string): DMessageContentFragment {
  return _createContentFragment(createDMetaPlaceholderPart(placeholderText));
}

export function createTextContentFragment(text: string): DMessageContentFragment {
  return _createContentFragment(createDMessageTextPart(text));
}

export function specialShallowReplaceTextContentFragment(copyFragment: DMessageContentFragment, text: string): DMessageContentFragment {
  return { ...copyFragment, part: createDMessageTextPart(text) };
}


function _createAttachmentFragment(title: string, caption: string, part: DMessageAttachmentFragment['part'], liveFileId: LiveFileId | undefined): DMessageAttachmentFragment {
  return { ft: 'attachment', fId: agiId('chat-dfragment' /* -attachment */), title, caption, created: Date.now(), part, liveFileId };
}

export function createDocAttachmentFragment(l1Title: string, caption: string, type: DMessageDocMimeType, data: DMessageDataInline, ref: string, meta?: DMessageDocMeta, liveFileId?: LiveFileId): DMessageAttachmentFragment {
  return _createAttachmentFragment(l1Title, caption, createDMessageDocPart(type, data, ref, l1Title, meta), liveFileId);
}

export function createImageAttachmentFragment(title: string, caption: string, dataRef: DMessageDataRef, imgAltText?: string, width?: number, height?: number): DMessageAttachmentFragment {
  return _createAttachmentFragment(title, caption, createDMessageImageRefPart(dataRef, imgAltText, width, height), undefined);
}


export function specialContentPartToDocAttachmentFragment(title: string, caption: string, contentPart: DMessageContentFragment['part'], ref: string, docMeta?: DMessageDocMeta): DMessageAttachmentFragment {
  if (isTextPart(contentPart))
    return createDocAttachmentFragment(title, caption, 'text/plain', createDMessageDataInlineText(contentPart.text, 'text/plain'), ref, docMeta);
  if (isImageRefPart(contentPart))
    return createImageAttachmentFragment(title, caption, _duplicateDataReference(contentPart.dataRef), contentPart.altText, contentPart.width, contentPart.height);
  return createDocAttachmentFragment('Error', 'Content to Attachment', 'text/plain', createDMessageDataInlineText(`Conversion of '${contentPart.pt}' is not supported yet.`, 'text/plain'), ref, docMeta);
}


function _createSentinelFragment(): _DMessageSentinelFragment {
  return { ft: '_ft_sentinel', fId: agiId('chat-dfragment' /* -_sentinel */) };
}


/// Helpers - Parts Creation

function createDMessageDocPart(type: DMessageDocMimeType, data: DMessageDataInline, ref: string, l1Title: string, meta?: DMessageDocMeta): DMessageDocPart {
  return { pt: 'doc', type, data, ref, l1Title, meta };
}

function createDMessageErrorPart(error: string): DMessageErrorPart {
  return { pt: 'error', error };
}

function createDMessageImageRefPart(dataRef: DMessageDataRef, altText?: string, width?: number, height?: number): DMessageImageRefPart {
  return { pt: 'image_ref', dataRef, altText, width, height };
}

function createDMessageTextPart(text: string): DMessageTextPart {
  return { pt: 'text', text };
}

function createDMessageFunctionCallInvocationPart(id: string, name: string, args: string | null, _description?: string, _args_schema?: object): DMessageToolInvocationPart {
  return { pt: 'tool_call', id, call: { type: 'function_call', name, args, _description, _args_schema } };
}

function createDMessageCodeExecutionInvocationPart(id: string, code: string, language?: string, variant?: 'gemini_auto_inline'): DMessageToolInvocationPart {
  return { pt: 'tool_call', id, call: { type: 'code_execution', variant, language, code } };
}

function createDMessageFunctionCallResponsePart(id: string, result: string, _name?: string, error?: boolean | string, _environment?: DMessageToolEnvironment): DMessageToolResponsePart {
  return { pt: 'tool_response', id, response: { type: 'function_call', result, _name }, error, _environment };
}

function createDMessageCodeExecutionResponsePart(id: string, result: string, _variant?: 'gemini_auto_inline', error?: boolean | string, _environment?: DMessageToolEnvironment): DMessageToolResponsePart {
  return { pt: 'tool_response', id, response: { type: 'code_execution', result, _variant }, error, _environment };
}

function createDMetaPlaceholderPart(placeholderText: string): DMetaPlaceholderPart {
  return { pt: 'ph', pText: placeholderText };
}

function createDMetaSentinelPart(): _DMetaSentinelPart {
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
      return _createAttachmentFragment(fragment.title, fragment.caption, _duplicatePart(fragment.part), fragment.liveFileId);

    case '_ft_sentinel':
      return _createSentinelFragment();

    // default:
    //   throw new Error('Invalid fragment');
  }
}

function _duplicatePart<TPart extends (DMessageContentFragment | DMessageAttachmentFragment)['part']>(part: TPart): TPart {
  switch (part.pt) {
    case 'doc':
      return createDMessageDocPart(part.type, _duplicateInlineData(part.data), part.ref, part.l1Title, part.meta ? { ...part.meta } : undefined) as TPart;

    case 'error':
      return createDMessageErrorPart(part.error) as TPart;

    case 'image_ref':
      return createDMessageImageRefPart(_duplicateDataReference(part.dataRef), part.altText, part.width, part.height) as TPart;

    case 'ph':
      return createDMetaPlaceholderPart(part.pText) as TPart;

    case 'text':
      return createDMessageTextPart(part.text) as TPart;

    case 'tool_call':
      const call = part.call;
      if (call.type === 'function_call')
        return createDMessageFunctionCallInvocationPart(part.id, call.name, call.args, call._description, call._args_schema ? { ...call._args_schema } : undefined) as TPart;
      else
        return createDMessageCodeExecutionInvocationPart(part.id, call.code, call.language, call.variant) as TPart;

    case 'tool_response':
      const response = part.response;
      if (response.type === 'function_call')
        return createDMessageFunctionCallResponsePart(part.id, response.result, response._name, part.error, part._environment) as TPart;
      else
        return createDMessageCodeExecutionResponsePart(part.id, response.result, response._variant, part.error, part._environment) as TPart;

    case '_pt_sentinel':
      return createDMetaSentinelPart() as TPart;
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

function _duplicateObjectWarning<T extends Record<string, any>>(obj: T | undefined, devPlace: string): T | undefined {
  console.warn('[DEV]: implement deep copy for:', devPlace);
  if (!obj) return obj;
  return { ...obj };
}
