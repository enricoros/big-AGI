import type { LiveFileId } from '~/common/livefile/liveFile.types';
import { agiId } from '~/common/util/idUtils';
import { ellipsizeMiddle } from '~/common/util/textUtils';


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
  | DMessageReferencePart         // reference (e.g. zync entity) Content, such as a Asset (image, audio, PFD, etc.), chat, persona, etc.
  | DMessageImageRefPart          // large image
  | DMessageToolInvocationPart    // shown to dev only, signature of the llm function call
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
  | DMessageReferencePart         // reference (e.g. zync entity) Attachment
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
  | DVoidModelAnnotationsPart     // (non submitted) model references, citations, etc.
  | DVoidModelAuxPart             // (non submitted) model auxiliary information, from the model itself
  | DVoidPlaceholderPart          // (non submitted) placeholder to be replaced by another part
  | _SentinelPart
>;

export type DVoidFragmentModelAnnotations = _NarrowFragmentToPart<DMessageVoidFragment, DVoidModelAnnotationsPart>;
type _DVoidFragmentModelAux = _NarrowFragmentToPart<DMessageVoidFragment, DVoidModelAuxPart>;
type _DVoidFragmentPlaceholder = _NarrowFragmentToPart<DMessageVoidFragment, DVoidPlaceholderPart>;
type _NarrowFragmentToPart<TFragment extends DMessageFragment, TPart> = TFragment & { part: TPart };


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
  originId?: string;                  // optional, for multi-model, identifies which actor produced this fragment
  vendorState?: DMessageFragmentVendorState; // optional vendor-specific protocol state (opaque, lossy-safe)
}

/**
 * Carries opaque vendor metadata required for protocol correctness - i.e. state continuity tokens, encrypted signatures, protocol quirks.
 * - Lossy-safe: Can be dropped during conversion/export without breaking functionality.
 * - Graceful-degrade on missing.
 */
export type DMessageFragmentVendorState = Record<string, unknown> & {
  gemini?: {
    thoughtSignature?: string; // Gemini 3+ - echoed back to maintain reasoning context
  };
  // Future: openai?: { ... }, anthropic?: { ... }
}


/// Parts - STABLE ///

// - Data at rest: these are used in the DMessage objects
// - DO NOT CHANGE - think twice (data at rest)
// Small and efficient (larger objects need to only be referred to)

export type DMessageTextPart = { pt: 'text', text: string };

export type DMessageErrorPart = { pt: 'error', error: string, hint?: DMessageErrorPartHint };

type DMessageErrorPartHint =
  // AIX streaming errors (from aixClassifyStreamingError)
  | 'aix-client-aborted'
  | 'aix-net-disconnected'
  | 'aix-request-exceeded'
  | 'aix-response-captive'
  | 'aix-net-unknown'
  | 'aix-processing-error'
  // Allow custom hints
  | string;

/**
 * @deprecated replaced by DMessageZyncAssetReferencePart to an image asset; here for migration purposes
 */
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
  srcOcrFrom?: 'image' | 'pdf' | 'image-caption';
}


export type DMessageReferencePart =
  | DMessageZyncAssetReferencePart
  // | DMessageURLReferencePart // External: URLs, cloud storage, local files
  // | DMessageCloudStorageReferencePart // External: Google Drive, Dropbox, OneDrive
  // | DMessageLocalFileReferencePart // Local: File system references, Live Files
  | _DMessageReferencePartBase<'_sentinel'>;

type _DMessageReferencePartBase<TRt extends string, TRefSpecificFields = {}> = {
  pt: 'reference';
  rt: TRt;
} & TRefSpecificFields;

type _DMessageZyncReferencePart<TZT extends ZYNC.Typename, TZTSpecificFields = {}> = _DMessageReferencePartBase<'zync', {
  zType: TZT;
  zUuid: ZYNC_Entity.UUID;
  // zRelationship: 'live', ...
  zRefSummary?: DMessageTextPart;  // text summary of the reference for text-only models and accessibility
} & TZTSpecificFields>;
const MAX_ZYNC_REFERENCE_SUMMARY_LEN = 512; // max alt text length for Zync Asset Reference Parts

export type DMessageZyncAssetReferencePart = _DMessageZyncReferencePart<'asset', {
  // denorm fields for quick display
  assetType: 'image' | 'audio'
  // to be used during migration, then ignored
  _legacyImageRefPart?: {
    pt: 'image_ref';
    dataRef: Extract<DMessageDataRef, { reftype: 'dblob' }>;
    altText?: string;
    width?: number;
    height?: number;
  };
}>;

// type _DMessageZyncChatReferencePart = _DMessageZyncReferencePart<'chat', { messageAnchor?: string; }>;
// type _DMessageZyncPersonaReferencePart = _DMessageZyncReferencePart<'persona', { Persona referencing, e.g. what aspect, what purpose, what content, ... }>;

// TEMP: placehoders to avoid circular deps during the transition times
namespace ZYNC { export type Typename = 'asset' | '_sanity_sentinel_'; }
namespace ZYNC_Entity { export type UUID = string; }


export type DMessageToolInvocationPart = {
  pt: 'tool_invocation',
  /** Matches the corresponding tool_response's id for pairing - set by the LLM, unique per message, at least */
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
  /** Set by the response (or upstream server hosted response), matches the corresponding tool_invocation's id for pairing */
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


type DVoidModelAnnotationsPart = {
  pt: 'annotations',
  annotations: readonly DVoidWebCitation[],
};

export type DVoidWebCitation = {
  type: 'citation',
  url: string,
  title: string,
  refNumber?: number,
  pubTs?: number, // publication timestamp
  ranges: readonly { startIndex: number, endIndex: number, textSnippet?: string }[],
};


export type DVoidModelAuxPart = {
  pt: 'ma',
  aType: 'reasoning', // note, we don't specialize to 'ant-thinking' here, as we can infer it from the presence of textSignature or redactedData
  aText: string,
  // [Anthropic] attributes, if present, they imply "Extended Thinking" object(s)
  textSignature?: string,
  redactedData?: readonly string[],
};

export type DVoidPlaceholderPart = {
  pt: 'ph',
  pText: string,
  pType?: 'chat-gen-follow-up',  // a follow-up is being generated
  modelOp?: DVoidPlaceholderModelOp,
  aixControl?: DVoidPlaceholderAixControlRetry,
};

export type DVoidPlaceholderModelOp = {
  mot: 'search-web' | 'gen-image' | 'code-exec',
  cts: number, // client-based timestamp
};

type DVoidPlaceholderAixControlRetry = {
  ctl: 'ec-retry',  // control type: error correction retry
  rScope: 'srv-dispatch' | 'srv-op' | 'cli-ll',  // srv-dispatch: dispatch fetch, srv-op: operation-level, cli-ll: client low-level
  rAttempt?: number,  // attempt number (starts from 2 to be clear it's a retry)
  rStrat?: 'cli-ll-reconnect' | 'cli-ll-resume',  // strategy for cli-ll scope (reconnect: new request, resume: continue from handle)
  rCauseHttp?: number,  // HTTP status code if available (e.g., 429, 503, 502)
  rCauseConn?: string,  // connection error type if available (e.g., 'net-disconnected', 'timeout')
};

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
type DBlobAssetId = string; // legacy type, expended here (not included) for migration purposes


/// Helpers - Fragment Type Guards - (we don't need 'fragment is X' since TypeScript 5.5.2)

export function isContentFragment(fragment: DMessageFragment): fragment is DMessageContentFragment {
  return fragment.ft === 'content' && !!fragment.part?.pt;
}

export function isTextContentFragment(fragment: DMessageFragment): fragment is DMessageContentFragment & { part: DMessageTextPart } {
  return fragment.ft === 'content' && fragment.part.pt === 'text';
}

export function isAttachmentFragment(fragment: DMessageFragment): fragment is DMessageAttachmentFragment {
  return fragment.ft === 'attachment' && !!fragment.part?.pt;
}

export function isContentOrAttachmentFragment(fragment: DMessageFragment) {
  return fragment.ft === 'content' || fragment.ft === 'attachment';
}


export function isVoidFragment(fragment: DMessageFragment): fragment is DMessageVoidFragment {
  return fragment.ft === 'void' && !!fragment.part?.pt;
}

export function isVoidAnnotationsFragment(fragment: DMessageFragment): fragment is DVoidFragmentModelAnnotations {
  return fragment.ft === 'void' && fragment.part.pt === 'annotations';
}

export function isVoidPlaceholderFragment(fragment: DMessageFragment): fragment is _DVoidFragmentPlaceholder {
  return fragment.ft === 'void' && fragment.part.pt === 'ph';
}

export function isVoidThinkingFragment(fragment: DMessageFragment): fragment is _DVoidFragmentModelAux {
  return fragment.ft === 'void' && fragment.part.pt === 'ma' && fragment.part.aType === 'reasoning';
}


export function isZyncAssetReferencePart(part: DMessageContentFragment['part'] | DMessageAttachmentFragment['part']): part is DMessageZyncAssetReferencePart {
  return part.pt === 'reference' && part.rt === 'zync' && part.zType === 'asset';
}

export function isZyncAssetImageReferencePart(part: DMessageContentFragment['part'] | DMessageAttachmentFragment['part']): part is DMessageZyncAssetReferencePart {
  return part.pt === 'reference' && part.rt === 'zync' && part.zType === 'asset' && part.assetType === 'image';
}

export function isZyncAssetImageReferencePartWithLegacyDBlob(part: DMessageContentFragment['part'] | DMessageAttachmentFragment['part']): part is DMessageZyncAssetReferencePart {
  return part.pt === 'reference' && part.rt === 'zync' && part.zType === 'asset' && part.assetType === 'image' && part._legacyImageRefPart?.dataRef?.reftype === 'dblob';
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

export function isToolInvocationPart(part: DMessageContentFragment['part']): part is DMessageToolInvocationPart {
  return part.pt === 'tool_invocation';
}

export function isToolResponsePart(part: DMessageContentFragment['part']): part is DMessageToolResponsePart {
  return part.pt === 'tool_response';
}

export function isToolResponseFunctionCallPart(part: DMessageContentFragment['part']): part is DMessageToolResponsePart & { response: { type: 'function_call' } } {
  return part.pt === 'tool_response' && part.response.type === 'function_call';
}

export function isAnnotationsPart(part: DMessageVoidFragment['part']) {
  return part.pt === 'annotations';
}

export function isModelAuxPart(part: DMessageVoidFragment['part']) {
  return part.pt === 'ma';
}

export function isPlaceholderPart(part: DMessageVoidFragment['part']) {
  return part.pt === 'ph';
}


/// Content Fragments - Creation & Duplication

export function createTextContentFragment(text: string): DMessageContentFragment {
  return _createContentFragment(_create_Text_Part(text));
}

export function createErrorContentFragment(error: string, hint?: DMessageErrorPartHint): DMessageContentFragment {
  return _createContentFragment(_create_Error_Part(error, hint));
}

export function createZyncAssetReferenceContentFragment(assetUuid: ZYNC_Entity.UUID, refSummary: string | undefined, assetType: 'image' | 'audio', legacyImageRefPart?: DMessageZyncAssetReferencePart['_legacyImageRefPart']): DMessageContentFragment {
  return _createContentFragment(createDMessageZyncAssetReferencePart(assetUuid, refSummary, assetType, legacyImageRefPart));
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

export function createZyncAssetReferenceAttachmentFragment(title: string, caption: string, assetUuid: ZYNC_Entity.UUID, refSummary: string | undefined, assetType: 'image' | 'audio', legacyImageRefPart?: DMessageZyncAssetReferencePart['_legacyImageRefPart']): DMessageAttachmentFragment {
  return _createAttachmentFragment(title, caption, createDMessageZyncAssetReferencePart(assetUuid, refSummary, assetType, legacyImageRefPart), undefined);
}

export function createDocAttachmentFragment(l1Title: string, caption: string, vdt: DMessageDocMimeType, data: DMessageDataInline, ref: string, version: number, meta?: DMessageDocMeta, liveFileId?: LiveFileId): DMessageAttachmentFragment {
  return _createAttachmentFragment(l1Title, caption, _create_Doc_Part(vdt, data, ref, l1Title, version, meta), liveFileId);
}

export function specialContentPartToDocAttachmentFragment(title: string, caption: string, vdt: DMessageDocMimeType, contentPart: DMessageContentFragment['part'], ref: string, docMeta?: DMessageDocMeta): DMessageAttachmentFragment {
  switch (true) {
    case isTextPart(contentPart):
      return createDocAttachmentFragment(title, caption, vdt, createDMessageDataInlineText(contentPart.text, 'text/plain'), ref, 2 /* As we attach our messages, we start from 2 */, docMeta);
    case isZyncAssetReferencePart(contentPart):
      return createZyncAssetReferenceAttachmentFragment(title, caption, contentPart.zUuid, contentPart.zRefSummary?.text, contentPart.assetType, contentPart._legacyImageRefPart);
    default:
      return createDocAttachmentFragment('Error', 'Content to Attachment', vdt, createDMessageDataInlineText(`Conversion of '${contentPart.pt}' is not supported yet.`, 'text/plain'), ref, 1 /* error has no version really */, docMeta);
  }
}

function _createAttachmentFragment(title: string, caption: string, part: DMessageAttachmentFragment['part'], liveFileId: LiveFileId | undefined): DMessageAttachmentFragment {
  return { ft: 'attachment', fId: agiId('chat-dfragment' /* -attachment */), title, caption, created: Date.now(), part, liveFileId };
}


/// Void Fragments - Creation & Duplication

export function createAnnotationsVoidFragment(annotations: DVoidWebCitation[]): DMessageVoidFragment {
  return _createVoidFragment(_create_Annotations_Part(annotations));
}

export function createModelAuxVoidFragment(aType: DVoidModelAuxPart['aType'], aText: string, textSignature?: string, redactedData?: string[]): DMessageVoidFragment {
  return _createVoidFragment(_create_ModelAux_Part(aType, aText, textSignature, redactedData));
}

export function createPlaceholderVoidFragment(placeholderText: string, placeholderType?: DVoidPlaceholderPart['pType'], modelOp?: DVoidPlaceholderModelOp, aixControl?: DVoidPlaceholderPart['aixControl']): DMessageVoidFragment {
  return _createVoidFragment(_create_Placeholder_Part(placeholderText, placeholderType, modelOp, aixControl));
}

function _createVoidFragment(part: DMessageVoidFragment['part']): DMessageVoidFragment {
  return { ft: 'void', fId: agiId('chat-dfragment' /* -void */), part };
}


/// Sentinel Fragments - only here to force the typesystem to work

function _createSentinelFragment(): _SentinelFragment {
  return { ft: '_ft_sentinel', fId: agiId('chat-dfragment' /* -_sentinel */) };
}


export function duplicateDMessageFragments(fragments: Readonly<DMessageFragment[]>, skipVoid: boolean): DMessageFragment[] {
  return !skipVoid ? fragments.map(_duplicateFragment)
    : fragments.map(_duplicateFragment).filter(f => f.ft !== 'void');
}

/**
 * Duplicates a fragment with a new ID while preserving content-related metadata:
 * - Preserved: originId, vendorState, mutability
 * - Cleared: fId (new ID), identity (per spec: "removed on duplication (new edit)")
 */
function _duplicateFragment(fragment: DMessageFragment): DMessageFragment {
  switch (fragment.ft) {
    case 'content':
      return _carryMeta(fragment, _createContentFragment(_duplicate_Part(fragment.part)));

    case 'attachment':
      return _carryMeta(fragment, _createAttachmentFragment(fragment.title, fragment.caption, _duplicate_Part(fragment.part), fragment.liveFileId));

    case 'void':
      return _carryMeta(fragment, _createVoidFragment(_duplicate_Part(fragment.part)));

    case '_ft_sentinel':
      return _createSentinelFragment();

    default:
      console.warn('[DEV] _duplicateFragment: Unknown fragment type, will duplicate as Error', { fragment });
      return createErrorContentFragment(`Unknown fragment type '${(fragment as any)?.ft || '(undefined)'}'`);
  }
}

/** Duplication: Preserves optional DMessageFragment metadata from source to target. */
function _carryMeta<T extends DMessageFragment>(source: Readonly<DMessageFragment>, target: T): T {
  // quick-out: sentinels don't have metadata
  if (source.ft === '_ft_sentinel' || target.ft === '_ft_sentinel')
    return target;

  let enriched = target;
  if ('originId' in source && source.originId)
    enriched = { ...enriched, originId: source.originId };

  if ('vendorState' in source && source.vendorState)
    enriched = { ...enriched, vendorState: structuredClone(source.vendorState) };

  return enriched;
}


/// Helpers - Parts Creation & Duplication

function _create_Text_Part(text: string): DMessageTextPart {
  return { pt: 'text', text };
}

function _create_Error_Part(error: string, hint?: DMessageErrorPartHint): DMessageErrorPart {
  return { pt: 'error', error, ...(hint && { hint }) };
}

export function createDMessageZyncAssetReferencePart(zUuid: ZYNC_Entity.UUID, refSummary: string | undefined, assetType: 'image' | 'audio', legacyImageRefPart?: DMessageZyncAssetReferencePart['_legacyImageRefPart']): DMessageZyncAssetReferencePart {
  return {
    pt: 'reference',
    rt: 'zync',
    zType: 'asset',
    zUuid,
    ...(refSummary && { zRefSummary: { pt: 'text', text: ellipsizeMiddle(refSummary, MAX_ZYNC_REFERENCE_SUMMARY_LEN) } }),
    assetType,
    ...(legacyImageRefPart && { _legacyImageRefPart: { ...legacyImageRefPart } }),
  };
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

export function createDVoidWebCitation(url: string, title: string, refNumber?: number, rangeStartIndex?: number, rangeEndIndex?: number, rangeTextSnippet?: string, pubTs?: number): DVoidWebCitation {
  return {
    type: 'citation', url, title, ...(refNumber !== undefined ? { refNumber } : {}), ...(pubTs !== undefined ? { pubTs } : {}),
    ranges: (rangeStartIndex !== undefined && rangeEndIndex !== undefined) ? [{
      startIndex: rangeStartIndex,
      endIndex: rangeEndIndex,
      ...(rangeTextSnippet ? { textSnippet: rangeTextSnippet } : {}),
    }] : [],
  };
}

function _create_Annotations_Part(annotations: DVoidWebCitation[]): DVoidModelAnnotationsPart {
  return { pt: 'annotations', annotations };
}

function _create_ModelAux_Part(aType: DVoidModelAuxPart['aType'], aText: string, textSignature?: string, redactedData?: Readonly<string[]>): DVoidModelAuxPart {
  return {
    pt: 'ma', aType, aText,
    ...(textSignature !== undefined ? { textSignature } : undefined),
    ...(redactedData ? { redactedData: Array.from(redactedData) /* creates a mutable copy of the array */ } : undefined),
  };
}

function _create_Placeholder_Part(placeholderText: string, pType?: DVoidPlaceholderPart['pType'], modelOp?: DVoidPlaceholderModelOp, aixControl?: DVoidPlaceholderPart['aixControl']): DVoidPlaceholderPart {
  return { pt: 'ph', pText: placeholderText, ...(pType ? { pType } : undefined), ...(modelOp ? { modelOp: { ...modelOp } } : undefined), ...(aixControl ? { aixControl: { ...aixControl } } : undefined) };
}

function _create_Sentinel_Part(): _SentinelPart {
  return { pt: '_pt_sentinel' };
}

function _duplicate_Part<TPart extends (DMessageContentFragment | DMessageAttachmentFragment | DMessageVoidFragment)['part']>(part: TPart): TPart {
  const pt = part.pt;
  switch (pt) {
    case 'doc':
      const newDocVersion = Number(part.version ?? 1); // we don't increase the version on duplication (not sure we should?)
      return _create_Doc_Part(part.vdt, _duplicate_InlineData(part.data), part.ref, part.l1Title, newDocVersion, part.meta ? { ...part.meta } : undefined) as TPart;

    case 'error':
      return _create_Error_Part(part.error, part.hint) as TPart;

    case 'reference':
      const rt = part.rt;
      switch (rt) {
        case 'zync':
          switch (part.zType) {
            case 'asset':
              // Zync Asset Reference: new fragment, with the exact same reference (and fallback, if still in the migration period)
              return createDMessageZyncAssetReferencePart(part.zUuid, part.zRefSummary?.text, part.assetType, part._legacyImageRefPart ? { ...part._legacyImageRefPart } : undefined) as TPart;

            default:
              const _exhaustiveCheck: never = part.zType;
              console.warn(`[DEV] _duplicate_Part: Unsupported zync reference type '${part.zType}', using fallback`, { part });
              return structuredClone(part) as TPart; // fallback to structured clone for unknown parts
          }
        case '_sentinel':
          break; // nothing to do here - this is a sentinel type
        default:
          const _exhaustiveCheck: never = rt;
          console.warn(`[DEV] _duplicate_Part: Unsupported reference type '${rt}', using fallback`, { part });
      }
      return structuredClone(part) as TPart;

    case 'image_ref':
      return _create_ImageRef_Part(_duplicate_DataReference(part.dataRef), part.altText, part.width, part.height) as TPart;

    case 'annotations':
      const annotationsDeepCopy = part.annotations.map(citation => ({
        ...citation,
        ranges: citation.ranges.map(range => ({
          ...range,
        })),
      }));
      return _create_Annotations_Part(annotationsDeepCopy) as TPart;

    case 'ma':
      return _create_ModelAux_Part(part.aType, part.aText, part.textSignature, part.redactedData) as TPart;

    case 'ph':
      return _create_Placeholder_Part(part.pText, part.pType, part.modelOp, part.aixControl) as TPart;

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

    default:
      const _exhaustiveCheck: never = pt;

      // console.warn('[DEV] _duplicate_Part: Unknown part type, will duplicate as Error', { part });
      // return _create_Error_Part(`Unknown part type '${(part as any)?.pt || '(undefined)'}'`) as TPart;

      // unexpected case: if we are here, the best to do is probably to return a clone of the part, as returning
      // nothing would corrupt the Fragment
      return structuredClone(part) as TPart; // fallback to structured clone for unknown parts
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

export function createDMessageDataRefDBlob(dblobAssetId: DBlobAssetId, mimeType: string, bytesSize: number): Extract<DMessageDataRef, { reftype: 'dblob' }> {
  return { reftype: 'dblob', dblobAssetId: dblobAssetId, mimeType, bytesSize };
}

function _createDMessageDataRefUrl(url: string): Extract<DMessageDataRef, { reftype: 'url' }> {
  return { reftype: 'url', url };
}

function _duplicate_DataReference(ref: DMessageDataRef): DMessageDataRef {
  switch (ref.reftype) {
    case 'dblob':
      return createDMessageDataRefDBlob(ref.dblobAssetId, ref.mimeType, ref.bytesSize);

    case 'url':
      return _createDMessageDataRefUrl(ref.url);
  }
}


/// Editor Helpers - Fragment Editing

/** Creates a new array of fragments with a specific originId assigned to each. */
export function fragmentsSetOriginId(fragments: ReadonlyArray<Readonly<DMessageFragment>>, originId: string): Readonly<DMessageFragment>[] {

  // shallow copy if empty or no originId
  if (!fragments.length || !originId) return [...fragments];

  // shallow-copy + set origin
  return fragments.map(fragment => ({ ...fragment, originId: originId }));
}

export function splitFragmentsByType(fragments: DMessageFragment[]) {
  // also see `useFragmentBuckets.ts` which inspired this function
  return fragments.reduce((acc, frag) => {
    if (isContentFragment(frag))
      acc.contentFragments.push(frag);
    else if (isAttachmentFragment(frag))
      acc.attachmentFragments.push(frag);
    else if (isVoidFragment(frag))
      acc.voidFragments.push(frag);
    else
      console.warn('[DEV] splitFragmentsByType: Unexpected fragment type:', frag.ft);
    return acc;
  }, {
    contentFragments: [] as DMessageContentFragment[],
    attachmentFragments: [] as DMessageAttachmentFragment[],
    voidFragments: [] as DMessageVoidFragment[],
  });
}

export function filterDocAttachmentFragments(fragments: DMessageAttachmentFragment[]) {
  return fragments.filter(fragment => isDocPart(fragment.part));
}

/**
 * Updates a fragment with the edited text, ensuring the fragment retains its type and structure.
 * @returns A new fragment with the edited text applied or null if the fragment type isn't handled.
 */
export function updateFragmentWithEditedText(fragment: DMessageContentFragment, editedText: string): DMessageContentFragment | null;
export function updateFragmentWithEditedText(fragment: DMessageAttachmentFragment, editedText: string): DMessageAttachmentFragment | null;
export function updateFragmentWithEditedText(fragment: DMessageFragment, editedText: string): DMessageFragment | null;
export function updateFragmentWithEditedText(
  fragment: DMessageFragment,
  editedText: string,
): DMessageFragment | null {

  // NOTE: we transfer the responsibility of this to the caller
  // if (editedText.length === 0) {
  //   // If the edited text is empty, we may choose to delete the fragment (depending on the caller's logic)
  //   return null;
  // }

  if (isContentFragment(fragment)) {
    const { fId, part, originId } = fragment;
    const preserveId = { fId, ...(originId && { originId }) } as const;

    const pt = part.pt;
    switch (pt) {

      case 'text':
        // Create a new text content fragment with the same fId and the edited text
        const newText = createTextContentFragment(editedText);
        return { ...newText, ...preserveId };

      case 'error':
        const newError = createErrorContentFragment(editedText);
        return { ...newError, ...preserveId };

      case 'reference':
        // For content reference fragments, there's no text to edit
        return null;

      case 'tool_invocation':
        if (part.invocation.type === 'function_call') {
          // Create a new tool invocation fragment with the edited args
          const newFragment = create_FunctionCallInvocation_ContentFragment(
            part.id, // Keep same id
            part.invocation.name,
            editedText, // args (if empty, it calls the funciton without params)
          );
          return { ...newFragment, ...preserveId };
        } else if (part.invocation.type === 'code_execution') {
          const newFragment = create_CodeExecutionInvocation_ContentFragment(
            part.id, // Keep same id
            part.invocation.language,
            editedText, // code
            part.invocation.author,
          );
          return { ...newFragment, ...preserveId };
        }
        break;

      case 'tool_response':
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
            return { ...newFragment, ...preserveId };
          } else if (response.type === 'code_execution') {
            const newFragment = create_CodeExecutionResponse_ContentFragment(
              part.id,
              part.error,
              editedText, // result
              response.executor,
              part.environment,
            );
            return { ...newFragment, ...preserveId };
          }
        }
        break;

      case 'image_ref':
      case '_pt_sentinel':
        // nothing to do here - not editable
        break;

      default:
        const _exhaustiveCheck: never = pt;
        break;
    }
  } else if (isAttachmentFragment(fragment)) {
    const { fId, part, title, caption, liveFileId, originId } = fragment;
    const preserveId = { fId, ...(originId && { originId }) } as const;

    const pt = part.pt;
    switch (pt) {
      case 'doc':
        // Create a new doc attachment fragment with the edited text
        const newDataInline: DMessageDataInline = createDMessageDataInlineText(
          editedText,
          part.data.mimeType,
        );
        const newDocFragment = createDocAttachmentFragment(
          part.l1Title || title,
          caption,
          part.vdt,
          newDataInline,
          part.ref,
          Number(part.version ?? 1) + 1, // Increment version as this has been edited - note: we could have used ?? to be more correct, but || is safer
          part.meta,
          liveFileId,
        );
        return { ...newDocFragment, ...preserveId };
      case 'reference':
      case 'image_ref':
      case '_pt_sentinel':
        // nothing to do here, as these parts are not editable in the same way
        break;
      default:
        const _exhaustiveCheck: never = pt;
        break;
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
