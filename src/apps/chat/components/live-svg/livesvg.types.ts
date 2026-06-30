/**
 * Live SVG Animator - shared types and constants.
 *
 * A forever-loop that evolves an animation as a stream of SVG frames (512x512 SVG + PNG render),
 * steerable live by voice. State lives in store-livesvg.ts; the loop is in livesvg.loop.ts.
 */

// configuration
export const LIVESVG_MAX_PAIRS = 3;           // bounded timeline buffer (frame pairs kept in context)
export const LIVESVG_MAX_IMAGES = 5;          // hard cap on image inputs per request (Cerebras Gemma rejects >5 with HTTP 413)
export const LIVESVG_FRAME_SIZE = 512;        // SVG canvas size (width/height/viewBox)
export const LIVESVG_PNG_SIZE = 384;          // rasterized PNG size fed back to the model (224 = Gemma's native vision tile; fewer image tokens)
export const LIVESVG_REPAIR_ATTEMPTS = 2;     // extra inference attempts when no valid <svg> is returned
export const LIVESVG_ASR_TIMEOUT_MS = 2500;   // silence gap that finalizes a spoken utterance
export const LIVESVG_RECENT_STEERS = 8;       // ticker depth (UI trust/feedback)
export const LIVESVG_FRAME_DELAY_MS = 500;    // pause between generations (rate-friendly pacing)
export const LIVESVG_FRAMES_PER_CALL_DEFAULT = 1; // how many SVG frames to request per inference call
export const LIVESVG_FRAMES_PER_CALL_MAX = 4;     // upper bound for frames-per-call
export const LIVESVG_TPS_HISTORY = 120;       // how many per-generation TPS samples to keep for the chart
export const LIVESVG_LOG_MAX = 80;            // how many event/error log lines to keep

export type LiveSvgLogKind = 'info' | 'warn' | 'error';
export interface LiveSvgLogEntry {
  id: number;
  kind: LiveSvgLogKind;
  text: string;
}

export type LiveSvgStatus = 'idle' | 'running' | 'stopping';

/** A spoken direction, captured live, applied at the next frame boundary. */
export interface Steer {
  text: string;
  tEnd: number; // ms timestamp when the utterance finished (Date.now)
}

/** Per-generation telemetry sample. */
export interface GenStat {
  tps: number;        // output tokens / second
  tokensIn: number;   // input tokens (new + cached)
  tokensOut: number;  // output tokens
  ms: number;         // generation wall/server time
}

/** One generated animation frame: an SVG plus its rasterized PNG render. */
export interface Frame {
  index: number;
  svg: string;        // sanitized, size-enforced 512x512 SVG markup
  pngBase64: string;  // raw base64 (no data: prefix) of the 512x512 PNG render
}

/**
 * One item in the incrementally-managed request history (a "tape"). The history is an ordered,
 * append-only transcript: user text (steers, preserved forever), generated frames (svg + png),
 * and 'system' markers that replace removed frames in place - each records how many consecutive
 * old frames were dropped at that position. Adjacent system markers coalesce; steers between
 * runs of removed frames keep the markers separate (so old steers cluster at the front over time).
 */
export type HistoryItem =
  | { kind: 'user'; text: string }
  | { kind: 'system'; removed: number }
  | ({ kind: 'frame' } & Frame);
