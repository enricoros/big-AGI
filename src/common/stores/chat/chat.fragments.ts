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
  | DMessageVoidFragment
  // | DMessageBeamFragment
  | _SentinelFragment
  ;

/**
 * Content Fragments: understood by ai and humans, processed by llms and stored
 */
export type DMessageContentFragment = _DMessageFragmentWrapper<'content',
  | DMessageTextPart              // plain text or mixed content -> BlockRenderer
  | DMessageImageRefPart          // large image
  | DMessageToolInvocationPart    // shown to dev only, singature of the llm function call
  | DMessageToolResponsePart      // shown to dev only, response of the llm
  | DMessageErrorPart             // red message, e.g. non-content application issues
  | _SentinelPart
>;

/**
 * Attachment Fragments: higher level representation of content, usually from attachments,
 * - image references, documents, etc.
 * - may still have upstream links for instance
 */
export type DMessageAttachmentFragment = _DMessageFragmentWrapper<'attachment',
  | DMessageDocPart               // document Attachment
  | DMessageImageRefPart          // image Attachment
  | _SentinelPart
> & {
  title: string;                  // label of the attachment (filename, named id, content overview, title..)
  caption: string;                // additional information, such as provenance, content preview, etc.
  created: number;
  liveFileId?: LiveFileId;        // [LiveFile] Optional. Relate to a LiveFile; if present, it may still be invalid, hence we cleanup on load
};

/**
 * Void Fragments: no meaning, pure cosmetic, not stored, not processed
 */
export type DMessageVoidFragment = _DMessageFragmentWrapper<'void',
  | DVoidPlaceholderPart          // (non submitted) placeholder to be replaced by another part
  | _SentinelPart
>;


// Future Examples: up to 1 per message, containing the Rays and Merges that would be used to restore the Beam state - could be volatile (omitted at save)
// could not be the data store itself, but only used for save/reload
// export type DMessageBeamFragment = DMessageBaseFragment<'beam'> & {
//   ft: 'beam',
//   fId: DMessageFragmentId;
//   beam: { rays: any[], merges: any[], ... };
// }

// Sentinel: force the typesystem to work, bark, and detect/reveal corner cases - unused aside from revealing fragment type issues
type _SentinelFragment = { ft: '_ft_sentinel', fId: DMessageFragmentId };

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

export type DMessageDocPart = { pt: 'doc', vdt: DMessageDocMimeType, data: DMessageDataInline, ref: string, l1Title: string, version?: number, meta?: DMessageDocMeta };
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
    args: string /*| null*/;  // JSON-encoded object (only objects are supported), if null there are no args and it's just a plain invocation
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

type DVoidPlaceholderPart = { pt: 'ph', pText: string };

type _SentinelPart = { pt: '_pt_sentinel' };


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

export function isTextContentFragment(fragment: DMessageFragment): fragment is DMessageContentFragment & { part: DMessageTextPart } {
  return fragment.ft === 'content' && fragment.part.pt === 'text';
}

export function isAttachmentFragment(fragment: DMessageFragment) {
  return fragment.ft === 'attachment';
}

export function isContentOrAttachmentFragment(fragment: DMessageFragment) {
  return fragment.ft === 'content' || fragment.ft === 'attachment';
}

export function isVoidFragment(fragment: DMessageFragment) {
  return fragment.ft === 'void';
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

export function isToolResponseFunctionCallPart(part: DMessageContentFragment['part']): part is DMessageToolResponsePart & { response: { type: 'function_call' } } {
  return part.pt === 'tool_response' && part.response.type === 'function_call';
}

export function isPlaceholderPart(part: DMessageVoidFragment['part']) {
  return part.pt === 'ph';
}


/// Content Fragments - Creation & Duplication

export function createTextContentFragment(text: string): DMessageContentFragment {
  return _createContentFragment(_create_Text_Part(text));
}

export function createErrorContentFragment(error: string): DMessageContentFragment {
  return _createContentFragment(_create_Error_Part(error));
}

export function createImageContentFragment(dataRef: DMessageDataRef, altText?: string, width?: number, height?: number): DMessageContentFragment {
  return _createContentFragment(_create_ImageRef_Part(dataRef, altText, width, height));
}

export function create_FunctionCallInvocation_ContentFragment(id: string, functionName: string, args: string /*| null*/): DMessageContentFragment {
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

function _createContentFragment(part: DMessageContentFragment['part']): DMessageContentFragment {
  return { ft: 'content', fId: agiId('chat-dfragment' /* -content */), part };
}


/// Attachment Fragments - Creation & Duplication

export function createDocAttachmentFragment(l1Title: string, caption: string, vdt: DMessageDocMimeType, data: DMessageDataInline, ref: string, version: number, meta?: DMessageDocMeta, liveFileId?: LiveFileId): DMessageAttachmentFragment {
  return _createAttachmentFragment(l1Title, caption, _create_Doc_Part(vdt, data, ref, l1Title, version, meta), liveFileId);
}

export function createImageAttachmentFragment(title: string, caption: string, dataRef: DMessageDataRef, imgAltText?: string, width?: number, height?: number): DMessageAttachmentFragment {
  return _createAttachmentFragment(title, caption, _create_ImageRef_Part(dataRef, imgAltText, width, height), undefined);
}

export function specialContentPartToDocAttachmentFragment(title: string, caption: string, vdt: DMessageDocMimeType, contentPart: DMessageContentFragment['part'], ref: string, docMeta?: DMessageDocMeta): DMessageAttachmentFragment {
  switch (true) {
    case isTextPart(contentPart):
      return createDocAttachmentFragment(title, caption, vdt, createDMessageDataInlineText(contentPart.text, 'text/plain'), ref, 2 /* As we attach our messages, we start from 2 */, docMeta);
    case isImageRefPart(contentPart):
      return createImageAttachmentFragment(title, caption, _duplicate_DataReference(contentPart.dataRef), contentPart.altText, contentPart.width, contentPart.height);
    default:
      return createDocAttachmentFragment('Error', 'Content to Attachment', vdt, createDMessageDataInlineText(`Conversion of '${contentPart.pt}' is not supported yet.`, 'text/plain'), ref, 1 /* error has no version really */, docMeta);
  }
}

function _createAttachmentFragment(title: string, caption: string, part: DMessageAttachmentFragment['part'], liveFileId: LiveFileId | undefined): DMessageAttachmentFragment {
  return { ft: 'attachment', fId: agiId('chat-dfragment' /* -attachment */), title, caption, created: Date.now(), part, liveFileId };
}


/// Void Fragments - Creation & Duplication

export function createPlaceholderVoidFragment(placeholderText: string): DMessageVoidFragment {
  return _createVoidFragment(_create_Placeholder_Part(placeholderText));
}

function _createVoidFragment(part: DMessageVoidFragment['part']): DMessageVoidFragment {
  return { ft: 'void', fId: agiId('chat-dfragment' /* -void */), part };
}


/// Sentinel Fragments - only here to force the typesystem to work

function _createSentinelFragment(): _SentinelFragment {
  return { ft: '_ft_sentinel', fId: agiId('chat-dfragment' /* -_sentinel */) };
}


export function duplicateDMessageFragmentsNoVoid(fragments: Readonly<DMessageFragment[]>): DMessageFragment[] {
  return fragments.map(_duplicateFragment).filter(f => f.ft !== 'void');
}

function _duplicateFragment(fragment: DMessageFragment): DMessageFragment {
  switch (fragment.ft) {
    case 'content':
      return _createContentFragment(_duplicate_Part(fragment.part));

    case 'attachment':
      return _createAttachmentFragment(fragment.title, fragment.caption, _duplicate_Part(fragment.part), fragment.liveFileId);

    case 'void':
      return _createVoidFragment(_duplicate_Part(fragment.part));

    case '_ft_sentinel':
      return _createSentinelFragment();

    default:
      console.warn('[DEV] _duplicateFragment: Unknown fragment type, will duplicate as Error', { fragment });
      return createErrorContentFragment(`Unknown fragment type '${(fragment as any)?.ft || '(undefined)'}'`);
  }
}


/// Helpers - Parts Creation & Duplication

function _create_Text_Part(text: string): DMessageTextPart {
  return { pt: 'text', text };
}

function _create_Error_Part(error: string): DMessageErrorPart {
  return { pt: 'error', error };
}

function _create_Doc_Part(vdt: DMessageDocMimeType, data: DMessageDataInline, ref: string, l1Title: string, version: number, meta?: DMessageDocMeta): DMessageDocPart {
  return { pt: 'doc', vdt, data, ref, l1Title, version, meta };
}

function _create_ImageRef_Part(dataRef: DMessageDataRef, altText?: string, width?: number, height?: number): DMessageImageRefPart {
  return { pt: 'image_ref', dataRef, altText, width, height };
}

function _create_FunctionCallInvocation_Part(id: string, functionName: string, args: string /*| null*/): DMessageToolInvocationPart {
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

function _create_Placeholder_Part(placeholderText: string): DVoidPlaceholderPart {
  return { pt: 'ph', pText: placeholderText };
}

function _create_Sentinel_Part(): _SentinelPart {
  return { pt: '_pt_sentinel' };
}

function _duplicate_Part<TPart extends (DMessageContentFragment | DMessageAttachmentFragment | DMessageVoidFragment)['part']>(part: TPart): TPart {
  switch (part.pt) {
    case 'doc':
      const newDocVersion = Number(part.version || 1); // we don't increase the version on duplication (not sure we should?)
      return _create_Doc_Part(part.vdt, _duplicate_InlineData(part.data), part.ref, part.l1Title, newDocVersion, part.meta ? { ...part.meta } : undefined) as TPart;

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

/**
 * Document View Mimetype - 3 uses:
 * - DMessageDocPart.vdt: the visual interpretation of the document (the mimetype of data is in .data.mimeType)
 * - AixWire_Parts.DocPart_schema: gives extra semantic meaning to the Doc part (in conjunction with DMessageDocMeta)
 * - used at rest, and in flight - be very careful not to change anything
 */
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


/// Editor Helpers - Fragment Editing

/**
 * Updates a fragment with the edited text, ensuring the fragment retains its type and structure.
 * @returns A new fragment with the edited text applied or null if the fragment type isn't handled.
 */
export function updateFragmentWithEditedText(
  fragment: DMessageFragment,
  editedText: string,
): DMessageFragment | null {

  if (editedText.length === 0) {
    // If the edited text is empty, we may choose to delete the fragment (depending on the caller's logic)
    return null;
  }

  if (isContentFragment(fragment)) {
    const { fId, part } = fragment;

    if (isTextPart(part)) {
      // Create a new text content fragment with the same fId and the edited text
      const newFragment = createTextContentFragment(editedText);
      return { ...newFragment, fId }; // Preserve original fId
    } else if (part.pt === 'error') {
      const newFragment = createErrorContentFragment(editedText);
      return { ...newFragment, fId }; // Preserve original fId
    } else if (part.pt === 'tool_invocation') {
      if (part.invocation.type === 'function_call') {
        // Create a new tool invocation fragment with the edited args
        const newFragment = create_FunctionCallInvocation_ContentFragment(
          part.id, // Keep same id
          part.invocation.name,
          editedText, // args (if empty, it calls the funciton without params)
        );
        return { ...newFragment, fId }; // Preserve original fId
      } else if (part.invocation.type === 'code_execution') {
        const newFragment = create_CodeExecutionInvocation_ContentFragment(
          part.id, // Keep same id
          part.invocation.language,
          editedText, // code
          part.invocation.author,
        );
        return { ...newFragment, fId };
      }
    } else if (part.pt === 'tool_response') {
      if (part.error) {
        // Update the error field in 'tool_response' part
        const newPart = {
          ...part,
          error: editedText,
        };
        return { ...fragment, part: newPart };
      } else {
        // Update the result field in 'tool_response' part
        const response = part.response;
        if (response.type === 'function_call') {
          const newFragment = create_FunctionCallResponse_ContentFragment(
            part.id,
            part.error,
            response.name,
            editedText, // result
            part.environment,
          );
          return { ...newFragment, fId };
        } else if (response.type === 'code_execution') {
          const newFragment = create_CodeExecutionResponse_ContentFragment(
            part.id,
            part.error,
            editedText, // result
            response.executor,
            part.environment,
          );
          return { ...newFragment, fId };
        }
      }
    }
  } else if (isAttachmentFragment(fragment)) {
    const { fId, part, title, caption, liveFileId } = fragment;

    if (isDocPart(part)) {
      // Create a new doc attachment fragment with the edited text
      const newDataInline: DMessageDataInline = createDMessageDataInlineText(
        editedText,
        part.data.mimeType,
      );
      const newFragment = createDocAttachmentFragment(
        part.l1Title || title,
        caption,
        part.vdt,
        newDataInline,
        part.ref,
        Number(part.version || 1) + 1, // Increment version as this has been edited - note: we could have used ?? to be more correct, but || is safer
        part.meta,
        liveFileId,
      );
      return { ...newFragment, fId }; // Preserve original fId
    }
    // Handle other attachment parts if needed
  }

  // Return null if the fragment type is not handled
  return null;
}

export function editTextPartsInline(fragments: DMessageFragment[], editText: (text: string, idx: number) => string): void {
  fragments.forEach((fragment, idx) => {
    if (isTextContentFragment(fragment))
      fragment.part.text = editText(fragment.part.text, idx);
  });
}

export function prependTextPartsInline(fragments: DMessageFragment[], textPrefix: string): void {
  for (const fragment of fragments) {
    if (!isTextContentFragment(fragment))
      continue;
    fragment.part.text = textPrefix + ' ' + fragment.part.text;
    return;
  }
  fragments.unshift(createTextContentFragment(textPrefix));
}
