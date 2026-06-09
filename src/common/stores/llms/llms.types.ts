//
// WARNING: Everything here is data at rest. Know what you're doing.
//

import type { ModelVendorId } from '~/modules/llms/vendors/vendors.registry';

import type { DModelParameterSpecAny, DModelParameterValues } from './llms.parameters';
import type { DModelPricing } from './llms.pricing';
import type { DModelsServiceId } from './llms.service.types';


/**
 * Identifies a model in the DB. Used to refer to Big-AGI client-side models, by their
 * IDs only. E.g. will use hooks with the store to react to them.
 */
export type DLLMId = string;

/**
 * Large Language Model - description and configuration (data object, stored)
 */
export interface DLLM {
  id: DLLMId;

  // factory properties (overwritten on update)
  label: string;
  created: number | 0;
  updated?: number | 0;
  pubDate?: string; // official release date in 'YYYYMMDD'
  description: string;
  hidden: boolean;

  // hard properties (overwritten on update)
  contextTokens: DLLMContextTokens;     // null: must assume it's unknown
  maxOutputTokens: DLLMMaxOutputTokens; // null: must assume it's unknown
  interfaces: DModelInterfaceV1[];      // if set, meaning this is the known and comprehensive set of interfaces
  benchmark?: { cbaElo?: number }; // benchmark values (Chat Bot Arena ELO)
  pricing?: DModelPricing;

  // parameters system (overwritten on update)
  parameterSpecs: DModelParameterSpecAny[];
  initialParameters: DModelParameterValues;

  // references (const, never change)
  sId: DModelsServiceId; // could be weak, but they're removed at the same time
  vId: ModelVendorId; // known hardcoded value

  // user edited properties - if not undefined/missing, they override the others
  userLabel?: string;
  userHidden?: boolean;
  userStarred?: boolean;
  userContextTokens?: DLLMContextTokens;
  userMaxOutputTokens?: DLLMMaxOutputTokens;
  userPricing?: DModelPricing;
  userParameters?: DModelParameterValues;

  // clone metadata - user-created duplicates of models with independent settings
  isUserClone?: boolean;        // true if this is a user-created clone
  cloneSourceId?: DLLMId;       // original model ID (for reference)
}


/**
 * Context window size in tokens.
 * - number: The context window size in tokens
 * - null: Unset (do not set in the output, do not assume a max value in the UI)
 */
export type DLLMContextTokens = number | null;

/**
 * Maximum output tokens.
 * - number: The maximum number of tokens the model can generate
 * - null: Unset (do not set in the output, do not assume a max value in the UI)
 */
export type DLLMMaxOutputTokens = number | null;


/**
 * Returns the effective display label for a model, respecting user overrides.
 * If the user has set a custom name via userLabel, that takes precedence over the vendor label.
 */
export function getLLMLabel(llm: DLLM): string {
  return llm.userLabel ?? llm.label;
}

/**
 * Computes the effective visibility of a model, respecting user overrides.
 * Returns true if the model should be hidden from UI selectors.
 *
 * Logic: userHidden takes precedence if set, otherwise falls back to the vendor's hidden value.
 * This allows users to override vendor defaults while still adopting new vendor visibility changes
 * for models they haven't explicitly shown/hidden.
 */
export function isLLMHidden(llm: DLLM): boolean {
  return llm.userHidden ?? llm.hidden ?? false;
}

export function isLLMVisible(llm: DLLM): boolean {
  return !(llm.userHidden ?? llm.hidden ?? false);
}

export function isLLMCustomUserParameters(llm: DLLM): boolean {
  return !!(llm.userParameters && Object.keys(llm.userParameters).length > 0);
}

/**
 * Returns the effective context token limit for a model.
 * Checks user override first, then vendor-specific parameters, then falls back to model default.
 */
export function getLLMContextTokens(llm: DLLM | null): DLLMContextTokens | undefined {
  if (!llm)
    return undefined; // undefined if no model

  // 1. Check user override first
  if (llm.userContextTokens !== undefined)
    return llm.userContextTokens;

  // 2. Check vendor-specific parameter overrides
  // [Anthropic, 1M] Check if this is an Anthropic model with 1M context enabled
  if (llm.vId === 'anthropic') {
    const vndAnt1MContext = llm.userParameters?.llmVndAnt1MContext ?? llm.initialParameters?.llmVndAnt1MContext;
    if (vndAnt1MContext === true)
      return 1_000_000;
  }

  // 3. Fall back to model default
  return llm.contextTokens; // null if unknown
}

/**
 * Returns the effective max output tokens for a model.
 * Checks user override first, then falls back to model default.
 */
export function getLLMMaxOutputTokens(llm: DLLM | null): DLLMMaxOutputTokens | undefined {
  if (!llm)
    return undefined; // undefined if no model

  // Check user override first, then fall back to model default
  return llm.userMaxOutputTokens ?? llm.maxOutputTokens;
}

/**
 * Parse the model's editorial `pubDate` ('YYYYMMDD') into a Date, or null if missing/malformed.
 * Date is constructed at local midnight - pubDate is day-precision, no time component.
 */
export function getLLMPubDate(llm: DLLM | null | undefined): Date | null {
  const p = llm?.pubDate;
  if (!p || !/^\d{8}$/.test(p)) return null;
  const y = parseInt(p.slice(0, 4), 10);
  const m = parseInt(p.slice(4, 6), 10) - 1; // JS Date months are 0-indexed
  const d = parseInt(p.slice(6, 8), 10);
  const date = new Date(y, m, d);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Number of days a model is considered "recently published" (keeps the "new" badge) after its editorial pubDate. */
export const LLM_RECENTLY_PUBLISHED_DAYS = 45; // ~1.5 vendor release cycles: outlasts launch-awareness, expires before the next-next model

/**
 * Whether the model was published within the last `LLM_RECENTLY_PUBLISHED_DAYS` days, based on its editorial `pubDate`.
 * Returns false when there's no/invalid pubDate. Reusable for the "new" badge and (later) surfacing the newest accessible models on the home page.
 */
export function isLLMRecentlyPublished(llm: DLLM | null | undefined, nowMs: number = Date.now()): boolean {
  const pubDate = getLLMPubDate(llm);
  if (!pubDate) return false;
  return (nowMs - pubDate.getTime()) < LLM_RECENTLY_PUBLISHED_DAYS * 24 * 60 * 60 * 1000;
}

/** Validated editorial `pubDate` as a sortable 'YYYYMMDD' string, or '' when missing/malformed ('' sorts before any real date). */
function _llmPubKey(llm: DLLM | null | undefined): string {
  const p = llm?.pubDate;
  return p && /^\d{8}$/.test(p) ? p : '';
}

/** Format an epoch-ms instant as a local-time 'YYYYMMDD' string (same local-midnight basis as getLLMPubDate). */
function _toPubDateStr(ms: number): string {
  const d = new Date(ms);
  const mm = d.getMonth() + 1, dd = d.getDate();
  return `${d.getFullYear()}${mm < 10 ? '0' : ''}${mm}${dd < 10 ? '0' : ''}${dd}`;
}

/**
 * Newest accessible models grouped by vendor, ordered most-recent-first: the vendor whose freshest
 * surfaced model has the latest `pubDate` leads - fitting for a "what's new" surface.
 *
 * Per vendor:
 *  - if it has recently-published models (within `LLM_RECENTLY_PUBLISHED_DAYS`, the "new" badge window),
 *    surface up to `maxNew` of them, in display order;
 *  - otherwise (when `maxFallback > 0`) surface up to `maxFallback` of its newest models by `pubDate`
 *    (descending; or first-in-display-order when no dates are known).
 * Vendors with no accessible models - or no pick - are omitted. Resolve the display name from `vendorId` at render time.
 *
 * Self-contained and fast: recency/ordering compare editorial 'YYYYMMDD' strings directly (no Date parsing per model).
 * Intended for surfacing "what's new" (e.g. the home page). Pass `llmsStoreState().llms`.
 */
export function getNewestModelsByVendor(llms: ReadonlyArray<DLLM>, options?: {
  maxNew?: number,       // cap of recently-published ("new") models per vendor (default 5)
  maxFallback?: number,  // when a vendor has nothing recently published, surface up to this many newest-by-date (default 2; 0 disables)
  onlyVisible?: boolean, // accessible (non-hidden) models only (default true)
}) {
  const { maxNew = 5, maxFallback = 2, onlyVisible = true } = options ?? {};
  const cutoff = _toPubDateStr(Date.now() - LLM_RECENTLY_PUBLISHED_DAYS * 24 * 60 * 60 * 1000); // 'YYYYMMDD' recency threshold, computed once

  // group accessible models by vendor (no clones, no symlink aliases), preserving the store's display order
  const byVendor = new Map<ModelVendorId, DLLM[]>();
  for (const llm of llms) {
    if (llm.isUserClone) continue;
    if (llm.label.startsWith('🔗')) continue; // skip symlink aliases: they share a base model and never carry the "new" badge
    if (onlyVisible && !isLLMVisible(llm)) continue;
    const group = byVendor.get(llm.vId);
    if (group) group.push(llm);
    else byVendor.set(llm.vId, [llm]);
  }

  return [...byVendor].flatMap(([vendorId, vendorModels]) => {

    // 1. recently-published ("new"): pubDate >= cutoff, in display order, capped to maxNew
    const isNew = vendorModels.filter(llm => _llmPubKey(llm) >= cutoff);
    let models: DLLM[];
    if (isNew.length)
      models = isNew.slice(0, maxNew);
    // 2. fallback: newest by pubDate (string-descending), else first-in-display-order, capped to maxFallback
    else if (maxFallback > 0) {
      const dated = vendorModels.map(llm => [llm, _llmPubKey(llm)] as const).filter(([, k]) => k !== '');
      models = (dated.length ? dated.sort((a, b) => a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0).map(([llm]) => llm) : vendorModels).slice(0, maxFallback);
    } else
      return [];

    // freshest surfaced pubDate (string max) -> most-recent-first vendor ordering
    const newest = models.reduce((mx, llm) => { const k = _llmPubKey(llm); return k > mx ? k : mx; }, '');
    return [{ vendorId, models, newest }];
  })
    // most-recent-first across vendors, then drop the ordering key
    .sort((a, b) => a.newest < b.newest ? 1 : a.newest > b.newest ? -1 : 0)
    .map(({ vendorId, models }) => ({ vendorId, models }));
}

/// Interfaces ///

// do not change anything below! those will be persisted in data
export type DModelInterfaceV1 =
  | 'oai-chat'
  | 'oai-chat-fn'
  | 'oai-chat-json'
  | 'ant-tools-search'
  | 'oai-chat-vision'
  | 'oai-chat-reasoning'
  | 'ant-prompt-caching'
  | 'gem-code-execution'
  | 'gem-interactions'
  | 'oai-prompt-caching'
  | 'oai-realtime'
  | 'oai-responses'
  | 'outputs-audio'            // TEMP: ui flag - supports audio output (e.g., text-to-speech)
  | 'outputs-image'            // TEMP: ui flag - supports image output (image generation)
  | 'outputs-no-text'          // disable text outputs (used in conjunction with alt-outputs) - assumed off
  | 'tools-web-search'         // TEMP: ui flag - supports integrated web search tool
  | 'hotfix-no-stream'         // disable streaming for o1-preview (old) and o1 (20241217)
  | 'hotfix-no-temperature'    // disable temperature for deepseek-r1
  | 'hotfix-no-webp'           // convert WebP images to PNG (e.g. some local models via LM Studio)
  | 'hotfix-strip-images'      // strip images from the input
  | 'hotfix-strip-sys0'        // strip the system instruction (unsupported)
  | 'hotfix-sys0-to-usr0'      // cast sys0 to usr0
  ;

// Model interfaces (chat, and function calls) - here as a preview, will be used more broadly in the future
// FIXME: keep this in sync with the server side on modules/llms/server/llm.server.types.ts
export const LLM_IF_OAI_Chat: DModelInterfaceV1 = 'oai-chat';
export const LLM_IF_OAI_Fn: DModelInterfaceV1 = 'oai-chat-fn';
/** @deprecated we don't se this one anymore 2026-04-19; suspended until we have a reason or per-model continuos validation of this */
export const LLM_IF_OAI_Json: DModelInterfaceV1 = 'oai-chat-json'; // for Structured Outputs (or JSON mode at worst)
export const LLM_IF_ANT_ToolsSearch: DModelInterfaceV1 = 'ant-tools-search';
// export const LLM_IF_OAI_JsonSchema: ... future?
export const LLM_IF_OAI_Vision: DModelInterfaceV1 = 'oai-chat-vision';
export const LLM_IF_OAI_Reasoning: DModelInterfaceV1 = 'oai-chat-reasoning';
export const LLM_IF_Outputs_Audio: DModelInterfaceV1 = 'outputs-audio';
export const LLM_IF_Outputs_Image: DModelInterfaceV1 = 'outputs-image';
export const LLM_IF_Outputs_NoText: DModelInterfaceV1 = 'outputs-no-text';
export const LLM_IF_Tools_WebSearch: DModelInterfaceV1 = 'tools-web-search';
export const LLM_IF_ANT_PromptCaching: DModelInterfaceV1 = 'ant-prompt-caching';
export const LLM_IF_GEM_CodeExecution: DModelInterfaceV1 = 'gem-code-execution';
export const LLM_IF_GEM_Interactions: DModelInterfaceV1 = 'gem-interactions';
export const LLM_IF_OAI_PromptCaching: DModelInterfaceV1 = 'oai-prompt-caching';
export const LLM_IF_OAI_Responses: DModelInterfaceV1 = 'oai-responses';
export const LLM_IF_HOTFIX_NoStream: DModelInterfaceV1 = 'hotfix-no-stream';
export const LLM_IF_HOTFIX_NoTemperature: DModelInterfaceV1 = 'hotfix-no-temperature';
export const LLM_IF_HOTFIX_NoWebP: DModelInterfaceV1 = 'hotfix-no-webp';
export const LLM_IF_HOTFIX_StripImages: DModelInterfaceV1 = 'hotfix-strip-images';
export const LLM_IF_HOTFIX_StripSys0: DModelInterfaceV1 = 'hotfix-strip-sys0';
export const LLM_IF_HOTFIX_Sys0ToUsr0: DModelInterfaceV1 = 'hotfix-sys0-to-usr0';

// TODO: just remove this, and move to a capabilities array (I/O/...)
// FIXME: keep this in sync with the client side on llms.types.ts
export const LLMS_ALL_INTERFACES = [
  // Declare common capabilities
  LLM_IF_OAI_Chat,            // MUST SUPPORT - chat interface
  LLM_IF_OAI_Vision,          // GREAT TO HAVE - image inputs
  LLM_IF_OAI_Fn,              // IMPORTANT - support for function calls
  LLM_IF_OAI_Json,            // not used for now: structured outputs
  LLM_IF_ANT_ToolsSearch,     // Anthropic tool: Tools Search
  // Generalized capabilities
  LLM_IF_OAI_Reasoning,       // COSMETIC ONLY - may show a 'brain' icon in supported screens
  LLM_IF_Outputs_Audio,       // COSMETIC ONLY FOR NOW - Models that generate audio output (TTS models)
  LLM_IF_Outputs_Image,       // COSMETIC ONLY FOR NOW - Models that can generate images (Gemini, DALL-E, etc.)
  LLM_IF_Outputs_NoText,      // Disable Text Outputs - e.g. Gemini pure TTS
  LLM_IF_Tools_WebSearch,     // Models with web search capability (Perplexity, GPT-4o Search, etc.)
  // Vendor-specific capabilities
  LLM_IF_ANT_PromptCaching,   // [Anthropic] model supports anthropic-specific caching
  LLM_IF_GEM_CodeExecution,   // [Gemini] Tool: code execution
  LLM_IF_GEM_Interactions,    // [Gemini] Interactions API (required by Deep Research agents)
  LLM_IF_OAI_PromptCaching,   // [OpenAI] model supports OpenAI prompt caching
  LLM_IF_OAI_Responses,       // [OpenAI] Responses API (new) support
  // Hotfixes to patch specific model quirks
  LLM_IF_HOTFIX_NoStream,     // disable streaming (e.g., o1-preview(old))
  LLM_IF_HOTFIX_NoTemperature,// disable temperature parameter (e.g., deepseek-r1)
  LLM_IF_HOTFIX_NoWebP,       // convert WebP images to PNG (e.g. LM Studio)
  LLM_IF_HOTFIX_StripImages,  // remove images from input (e.g. o3-mini-2025-01-31)
  LLM_IF_HOTFIX_StripSys0,    // strip system instruction (e.g. Gemini Image Generation 2025-03-13), excludes Sys0ToUsr0
  LLM_IF_HOTFIX_Sys0ToUsr0,   // downgrade system to user messages for this model (e.g. o1-mini-2024-09-12)
] as const;

// Future changes?
// export type DModelPartKind = 'text' | 'image' | 'audio' | 'video' | 'pdf';
// export type DModelCapability =
//   | 'input-text'
//   | 'input-image-data'
//   | 'input-multipart'
//   | 'output-text'
//   | 'output-function'
//   | 'output-image-data'
//   | 'if-chat'
//   | 'if-fast-chat'
//   ;
// modelcaps: DModelCapability[];
// inputTypes: {                     // future? the supported input formats
//   [key in DModelPartKind]?: {
//     // maxItemsPerInput?: number;
//     // maxFileSize?: number; // in bytes
//     // maxDurationPerInput?: number; // in seconds, for audio and video
//     // maxPagesPerInput?: number; // for PDF
//     // encodings?: ('base64' | 'utf-8')[];
//     mimeTypes?: string[];
//   }
// };
