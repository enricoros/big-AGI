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

export type DMessageErrorPart = { pt: 'error', error: string };

export type DMessageImageRefPart = { pt: 'image_ref', dataRef: DMessageDataRef, altText?: string, width?: number, height?: number };

export type DMessageDocPart = { pt: 'doc', vdt: DMessageDocMimeType, data: DMessageDataInline, ref: string, l1Title: string, meta?: DMessageDocMeta };
type DMessageDocMimeType =
// | 'application/vnd.agi.ego.fragments'         // for attaching messages
// | 'application/vnd.agi.imageRef'    // for image attachments with da - NO: makes no sense, as doc contains data
// | 'application/vnd.agi.plantuml'
// | 'image/svg+xml'
// | 'text/csv'                        // table editor
// | 'text/html'                       // can be rendered in iframes (RenderCode[HTML])
// | 'text/markdown'                   // can be rendered as markdown (note that text/plain can also)
  | 'application/vnd.agi.code'        // Blocks > RenderCode (it's a text/plain)
  | 'application/vnd.agi.ocr'         // images/pdfs converted as text
  | 'text/plain'                      // e.g. clipboard paste
  ;
type DMessageDocMeta = {
  codeLanguage?: string;
  srcFileName?: string;
  srcFileSize?: number;
  srcOcrFrom?: 'image' | 'pdf';
}

export type DMessageToolInvocationPart = {
  pt: 'tool_invocation',
  id: string,
  invocation: {
    type: 'function_call'
    name: string;             // Name of the function as passed from the definition
    args: string | null;      // JSON-encoded, if null there are no args
    // temporary, not stored
    _description?: string;    // Description from the definition
    _args_schema?: object;    // JSON Schema { type: 'object', properties: { ... } } from the definition
  } | {
    type: 'code_execution';
    language: string;
    code: string;
    author: 'gemini_auto_inline';
  }
};

export type DMessageToolResponsePart = {
  pt: 'tool_response',
  id: string,
  error: boolean | string,
  response: {
    type: 'function_call';
    name: string;             // Name of the function that produced the result
    result: string;           // The output
  } | {
    type: 'code_execution';
    result: string;           // The output
    executor: 'gemini_auto_inline';
  },
  environment: DMessageToolEnvironment,
};
type DMessageToolEnvironment = 'upstream' | 'server' | 'client';

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

export function isErrorPart(part: DMessageContentFragment['part']) {
  return part.pt === 'error';
}


export function editTextPartsInline(fragments: DMessageFragment[], editText: (text: string, idx: number) => string): void {
  fragments.forEach((fragment, idx) => {
    if (isContentFragment(fragment) && isTextPart(fragment.part))
      fragment.part.text = editText(fragment.part.text, idx);
  });
}

export function prependTextPartsInline(fragments: DMessageFragment[], textPrefix: string): void {
  for (const fragment of fragments) {
    if (!isContentFragment(fragment) || !isTextPart(fragment.part))
      continue;
    fragment.part.text = textPrefix + ' ' + fragment.part.text;
    return;
  }
  fragments.unshift(createTextContentFragment(textPrefix));
}


/// Fragments Creation & Duplication

export function createTextContentFragment(text: string): DMessageContentFragment {
  return _createContentFragment(_create_Text_Part(text));
}

export function createErrorContentFragment(error: string): DMessageContentFragment {
  return _createContentFragment(_create_Error_Part(error));
}

export function createImageContentFragment(dataRef: DMessageDataRef, altText?: string, width?: number, height?: number): DMessageContentFragment {
  return _createContentFragment(_create_ImageRef_Part(dataRef, altText, width, height));
}

export function create_FunctionCallInvocation_ContentFragment(id: string, functionName: string, args: string | null): DMessageContentFragment {
  return _createContentFragment(_create_FunctionCallInvocation_Part(id, functionName, args));
}

export function create_CodeExecutionInvocation_ContentFragment(id: string, language: string, code: string, author: 'gemini_auto_inline'): DMessageContentFragment {
  return _createContentFragment(_create_CodeExecutionInvocation_Part(id, language, code, author));
}

export function create_FunctionCallResponse_ContentFragment(id: string, error: boolean | string, name: string, result: string, environment: DMessageToolEnvironment): DMessageContentFragment {
  return _createContentFragment(_create_FunctionCallResponse_Part(id, error, name, result, environment));
}

export function create_CodeExecutionResponse_ContentFragment(id: string, error: boolean | string, result: string, executor: 'gemini_auto_inline', environment: DMessageToolEnvironment): DMessageContentFragment {
  return _createContentFragment(_create_CodeExecutionResponse_Part(id, error, result, executor, environment));
}

export function createPlaceholderMetaFragment(placeholderText: string): DMessageContentFragment {
  return _createContentFragment(_create_Placeholder_Part(placeholderText));
}

export function specialShallowReplaceTextContentFragment(copyFragment: DMessageContentFragment, text: string): DMessageContentFragment {
  // TODO: remove?
  return { ...copyFragment, part: _create_Text_Part(text) };
}

function _createContentFragment(part: DMessageContentFragment['part']): DMessageContentFragment {
  return { ft: 'content', fId: agiId('chat-dfragment' /* -content */), part };
}


export function createDocAttachmentFragment(l1Title: string, caption: string, vdt: DMessageDocMimeType, data: DMessageDataInline, ref: string, meta?: DMessageDocMeta, liveFileId?: LiveFileId): DMessageAttachmentFragment {
  return _createAttachmentFragment(l1Title, caption, _create_Doc_Part(vdt, data, ref, l1Title, meta), liveFileId);
}

export function createImageAttachmentFragment(title: string, caption: string, dataRef: DMessageDataRef, imgAltText?: string, width?: number, height?: number): DMessageAttachmentFragment {
  return _createAttachmentFragment(title, caption, _create_ImageRef_Part(dataRef, imgAltText, width, height), undefined);
}

export function specialContentPartToDocAttachmentFragment(title: string, caption: string, vdt: DMessageDocMimeType, contentPart: DMessageContentFragment['part'], ref: string, docMeta?: DMessageDocMeta): DMessageAttachmentFragment {
  switch (true) {
    case isTextPart(contentPart):
      return createDocAttachmentFragment(title, caption, vdt, createDMessageDataInlineText(contentPart.text, 'text/plain'), ref, docMeta);
    case isImageRefPart(contentPart):
      return createImageAttachmentFragment(title, caption, _duplicate_DataReference(contentPart.dataRef), contentPart.altText, contentPart.width, contentPart.height);
    default:
      return createDocAttachmentFragment('Error', 'Content to Attachment', vdt, createDMessageDataInlineText(`Conversion of '${contentPart.pt}' is not supported yet.`, 'text/plain'), ref, docMeta);
  }
}

function _createAttachmentFragment(title: string, caption: string, part: DMessageAttachmentFragment['part'], liveFileId: LiveFileId | undefined): DMessageAttachmentFragment {
  return { ft: 'attachment', fId: agiId('chat-dfragment' /* -attachment */), title, caption, created: Date.now(), part, liveFileId };
}


function _createSentinelFragment(): _DMessageSentinelFragment {
  return { ft: '_ft_sentinel', fId: agiId('chat-dfragment' /* -_sentinel */) };
}


export function duplicateDMessageFragmentsNoPH(fragments: Readonly<DMessageFragment[]>): DMessageFragment[] {
  return fragments.map(_duplicateFragment).filter(f => f.ft !== 'content' || f.part.pt !== 'ph');
}

function _duplicateFragment(fragment: DMessageFragment): DMessageFragment {
  switch (fragment.ft) {
    case 'content':
      return _createContentFragment(_duplicate_Part(fragment.part));

    case 'attachment':
      return _createAttachmentFragment(fragment.title, fragment.caption, _duplicate_Part(fragment.part), fragment.liveFileId);

    case '_ft_sentinel':
      return _createSentinelFragment();

    // default:
    //   throw new Error('Invalid fragment');
  }
}


/// Helpers - Parts Creation & Duplication

function _create_Text_Part(text: string): DMessageTextPart {
  return { pt: 'text', text };
}

function _create_Error_Part(error: string): DMessageErrorPart {
  return { pt: 'error', error };
}

function _create_Doc_Part(vdt: DMessageDocMimeType, data: DMessageDataInline, ref: string, l1Title: string, meta?: DMessageDocMeta): DMessageDocPart {
  return { pt: 'doc', vdt, data, ref, l1Title, meta };
}

function _create_ImageRef_Part(dataRef: DMessageDataRef, altText?: string, width?: number, height?: number): DMessageImageRefPart {
  return { pt: 'image_ref', dataRef, altText, width, height };
}

function _create_FunctionCallInvocation_Part(id: string, functionName: string, args: string | null): DMessageToolInvocationPart {
  return { pt: 'tool_invocation', id, invocation: { type: 'function_call', name: functionName, args } };
}

function _create_CodeExecutionInvocation_Part(id: string, language: string, code: string, author: 'gemini_auto_inline'): DMessageToolInvocationPart {
  return { pt: 'tool_invocation', id, invocation: { type: 'code_execution', language, code, author } };
}

function _create_FunctionCallResponse_Part(id: string, error: boolean | string, name: string, result: string, environment: DMessageToolEnvironment): DMessageToolResponsePart {
  return { pt: 'tool_response', id, error, response: { type: 'function_call', name, result }, environment };
}

function _create_CodeExecutionResponse_Part(id: string, error: boolean | string, result: string, executor: 'gemini_auto_inline', environment: DMessageToolEnvironment): DMessageToolResponsePart {
  return { pt: 'tool_response', id, error, response: { type: 'code_execution', result, executor }, environment };
}

function _create_Placeholder_Part(placeholderText: string): DMetaPlaceholderPart {
  return { pt: 'ph', pText: placeholderText };
}

function _create_Sentinel_Part(): _DMetaSentinelPart {
  return { pt: '_pt_sentinel' };
}

function _duplicate_Part<TPart extends (DMessageContentFragment | DMessageAttachmentFragment)['part']>(part: TPart): TPart {
  switch (part.pt) {
    case 'doc':
      return _create_Doc_Part(part.vdt, _duplicate_InlineData(part.data), part.ref, part.l1Title, part.meta ? { ...part.meta } : undefined) as TPart;

    case 'error':
      return _create_Error_Part(part.error) as TPart;

    case 'image_ref':
      return _create_ImageRef_Part(_duplicate_DataReference(part.dataRef), part.altText, part.width, part.height) as TPart;

    case 'ph':
      return _create_Placeholder_Part(part.pText) as TPart;

    case 'text':
      return _create_Text_Part(part.text) as TPart;

    case 'tool_invocation':
      return part.invocation.type === 'function_call'
        ? _create_FunctionCallInvocation_Part(part.id, part.invocation.name, part.invocation.args) as TPart
        : _create_CodeExecutionInvocation_Part(part.id, part.invocation.language, part.invocation.code, part.invocation.author) as TPart;

    case 'tool_response':
      return part.response.type === 'function_call'
        ? _create_FunctionCallResponse_Part(part.id, part.error, part.response.name, part.response.result, part.environment) as TPart
        : _create_CodeExecutionResponse_Part(part.id, part.error, part.response.result, part.response.executor, part.environment) as TPart;

    case '_pt_sentinel':
      return _create_Sentinel_Part() as TPart;
  }
}


/// Helpers - Data Reference Creation & Duplication

// Document View Mimetype - 3 uses:
// - DMessageDocPart.vdt: the visual interpretation of the document (the mimetype of data is in .data.mimeType)
// - AixWire_Parts.DocPart_schema: gives extra semantic meaning to the Doc part (in conjunction with DMessageDocMeta)
// - used at rest, and in flight - be very careful not to change anything
export const DVMimeType = {
  VndAgiCode: 'application/vnd.agi.code',
  VndAgiOcr: 'application/vnd.agi.ocr',
  TextPlain: 'text/plain',
} as const;

export function createDMessageDataInlineText(text: string, mimeType?: string): DMessageDataInline {
  return { idt: 'text', text, mimeType };
}

function _duplicate_InlineData(data: DMessageDataInline): DMessageDataInline {
  switch (data.idt) {
    case 'text':
      return createDMessageDataInlineText(data.text, data.mimeType);

    // case 'base64':
    //   return createDMessageDataInlineBase64(data.base64);
  }
}

export function createDMessageDataRefDBlob(dblobAssetId: DBlobAssetId, mimeType: string, bytesSize: number): DMessageDataRef {
  return { reftype: 'dblob', dblobAssetId: dblobAssetId, mimeType, bytesSize };
}

export function createDMessageDataRefUrl(url: string): DMessageDataRef {
  return { reftype: 'url', url };
}

function _duplicate_DataReference(ref: DMessageDataRef): DMessageDataRef {
  switch (ref.reftype) {
    case 'dblob':
      return createDMessageDataRefDBlob(ref.dblobAssetId, ref.mimeType, ref.bytesSize);

    case 'url':
      return createDMessageDataRefUrl(ref.url);
  }
}


// function _duplicateObjectWarning<T extends Record<string, any>>(obj: T | undefined, devPlace: string): T | undefined {
//   console.warn('[DEV]: implement deep copy for:', devPlace);
//   if (!obj) return obj;
//   return { ...obj };
// }
