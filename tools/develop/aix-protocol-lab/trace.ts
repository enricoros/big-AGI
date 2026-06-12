/**
 * AIX Protocol Lab - Trace format and recorder.
 *
 * A LabRun is the unit of capture: one logical generation against one provider, possibly
 * spanning multiple HTTP dispatches (Anthropic pause_turn continuations, operation retries).
 *
 * The recorder taps the real AIX pipeline at three levels, with exact attribution:
 *  - raw wire chunks (pre-demux, base64), via a tee on the Response body
 *  - demuxed wire events, via a wrapper on dispatch.chatGenerateParse
 *  - the parser's translation, via a recording proxy on the IParticleTransmitter it receives,
 *    plus the actual AixWire_Particles yielded by the executor
 *
 * Attribution invariant: the executor parses one demuxed event, then drains the transmitter
 * queue, before parsing the next event. Particles observed between parse(N) and parse(N+1)
 * therefore belong to event N. Particles seen while no event is open (e.g. connect-phase
 * heartbeats) land in the segment's looseParticles.
 */

import type { AixWire_Particles } from '~/modules/aix/server/api/aix.wiretypes';
import type { ChatGenerateDispatch, ChatGenerateParseFunction } from '~/modules/aix/server/dispatch/chatGenerate/chatGenerate.dispatch';
import type { IParticleTransmitter } from '~/modules/aix/server/dispatch/chatGenerate/parsers/IParticleTransmitter';
import type { AixDemuxers } from '~/modules/aix/server/dispatch/stream.demuxers';


// configuration
const CALL_ARG_STRING_CLAMP = 8192; // transmitter call args are a convenience view; full data lives in the particles


// -- Trace types --

export type LabFlavor =
  | 'anthropic-messages'
  | 'openai-responses'
  | 'openai-chat'
  | 'gemini-generate'
  | 'gemini-interactions';

export interface LabRunMeta {
  scenarioId: string;
  flavor: LabFlavor;
  dialect: string; // AixAPI_Access['dialect']
  modelId: string;
  streaming: boolean;
  demuxerFormat: AixDemuxers.StreamDemuxerFormat | null; // null = NS
  capturedAt: string; // ISO
  promptPreview: string;
  kind: 'capture' | 'replay' | 'oracle';
  replayOf?: string; // source file, when kind === 'replay'
  labVersion: 1;
}

export interface LabTransmitterCall {
  m: string; // IParticleTransmitter method name
  args: unknown[]; // long strings clamped (see CALL_ARG_STRING_CLAMP)
}

export interface LabDiag {
  level: 'log' | 'warn' | 'error';
  text: string;
}

/** One demuxed wire event, paired with everything the decode layer did with it. */
export interface LabEvent {
  i: number; // ordinal within segment
  t: number; // ms since segment start
  name?: string; // SSE event name (Anthropic, Gemini Interactions); undefined for data-only streams and NS bodies
  size: number; // eventData length in chars
  data: unknown; // decoded JSON payload, or the raw string when not JSON
  calls: LabTransmitterCall[]; // IParticleTransmitter calls made by the parser for this event
  particles: AixWire_Particles.ChatGenerateOp[]; // particles the executor yielded while this event was current
  diags: LabDiag[]; // console output emitted during this event's parse (and until the next)
  parseError?: string; // set when the parser threw (continuation/retry signals are recorded but expected)
}

/** One HTTP dispatch. A run has more than one on pause_turn continuation or operation retry. */
export interface LabSegment {
  startedAt: number; // epoch ms
  request: { url: string; method: string; body?: unknown }; // headers deliberately never recorded
  rawChunks?: { t: number; b64: string }[]; // pre-demux body bytes (post HTTP decompression)
  events: LabEvent[];
  looseParticles: { t: number; particle: AixWire_Particles.ChatGenerateOp }[]; // particles with no current event (connect heartbeats)
  looseDiags: LabDiag[]; // console output outside any event parse
}

export interface LabRun {
  v: 1;
  meta: LabRunMeta;
  segments: LabSegment[];
  /** Full ordered particle stream as the client would receive it (heartbeats included). */
  finalParticles: AixWire_Particles.ChatGenerateOp[];
  outcome: {
    ok: boolean;
    endReason?: string; // from the cg:'end' particle
    tokenStopReason?: string;
    aborted?: boolean;
    error?: string; // engine-level error, if the run died outside the particle contract
    durationMs?: number;
  };
}


// -- Small utilities --

export function clampString(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + ` …[+${(s.length - maxChars).toLocaleString()} chars]`;
}

function _clampDeep(value: unknown, maxChars: number): unknown {
  if (typeof value === 'string') return clampString(value, maxChars);
  if (Array.isArray(value)) return value.map(v => _clampDeep(v, maxChars));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = _clampDeep(v, maxChars);
    return out;
  }
  return value;
}

function _tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}


// -- Recording proxy over the real IParticleTransmitter --

/**
 * Forwards every call to the real transmitter, recording (method, args) via onCall.
 * The parser behaves identically; we just observe the translation.
 */
export function teeParticleTransmitter(real: IParticleTransmitter, onCall: (method: string, args: unknown[]) => void): IParticleTransmitter {
  return new Proxy(real, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function' || typeof prop !== 'string')
        return value;
      return (...args: unknown[]) => {
        onCall(prop, args);
        return value.apply(target, args);
      };
    },
  }) as IParticleTransmitter;
}


// -- Trace recorder --

export class TraceRecorder {

  readonly run: LabRun;

  private _segment: LabSegment | null = null;
  private _event: LabEvent | null = null;
  private _segmentStart = 0;
  private _runStart = Date.now();
  /** live references to dispatch.request objects - bodies serialize at finalize time, AFTER continuation mutations */
  private _requestRefs: ({ url: string; method: string } & Record<string, unknown>)[] = [];

  constructor(meta: LabRunMeta) {
    this.run = {
      v: 1,
      meta,
      segments: [],
      finalParticles: [],
      outcome: { ok: false },
    };
  }

  /**
   * Instruments a dispatch for tracing: opens a new segment, wraps the parse function for
   * per-event recording, and tees the response body for raw chunk capture.
   * @param dispatch the dispatch to instrument (returned object replaces it)
   * @param connect connection fallback when the dispatch has no customConnect (live fetch or synthetic replay Response)
   * @param captureRaw record pre-demux body bytes (skip for replays, where chunks come from the file)
   */
  instrumentDispatch(dispatch: ChatGenerateDispatch, connect: (signal: AbortSignal) => Promise<Response>, captureRaw: boolean): ChatGenerateDispatch {

    this._beginSegment(dispatch.request);

    // record the demuxer format once (replay needs it to rebuild the pipeline)
    if (this.run.segments.length === 1)
      this.run.meta.demuxerFormat = dispatch.demuxerFormat;

    const origParse = dispatch.chatGenerateParse;
    const tracedParse: ChatGenerateParseFunction = (pt, eventData, eventName, context) => {
      const event = this._beginEvent(eventName, eventData);
      const teePt = teeParticleTransmitter(pt, (m, args) => {
        event.calls.push({ m, args: args.map(a => _clampDeep(a, CALL_ARG_STRING_CLAMP)) });
      });
      try {
        origParse(teePt, eventData, eventName, context);
      } catch (error: any) {
        event.parseError = `${error?.name || 'Error'}: ${error?.message || String(error)}`;
        throw error;
      }
    };

    const origConnect = dispatch.customConnect ?? connect;
    const tracedConnect = async (signal: AbortSignal): Promise<Response> => {
      const response = await origConnect(signal);
      if (!captureRaw || !response.body) return response;
      const segment = this._segment;
      if (segment && !segment.rawChunks) segment.rawChunks = [];
      const tee = new TransformStream<Uint8Array, Uint8Array>({
        transform: (chunk, controller) => {
          segment?.rawChunks?.push({ t: Date.now() - this._segmentStart, b64: Buffer.from(chunk).toString('base64') });
          controller.enqueue(chunk);
        },
      });
      return new Response(response.body.pipeThrough(tee), { status: response.status, statusText: response.statusText, headers: response.headers });
    };

    return { ...dispatch, chatGenerateParse: tracedParse, customConnect: tracedConnect };
  }

  /** Called by the run loop for every particle the executor yields. */
  onParticle(particle: AixWire_Particles.ChatGenerateOp): void {
    this.run.finalParticles.push(particle);
    if (this._event)
      this._event.particles.push(particle);
    else if (this._segment)
      this._segment.looseParticles.push({ t: Date.now() - this._segmentStart, particle });

    // outcome tracking from the particle contract itself
    if ('cg' in particle && particle.cg === 'end') {
      this.run.outcome.endReason = particle.terminationReason;
      if (particle.tokenStopReason) this.run.outcome.tokenStopReason = particle.tokenStopReason;
    }
  }

  /** Console diagnostics, attributed to the current event when one is open. */
  onDiag(level: LabDiag['level'], text: string): void {
    const diag: LabDiag = { level, text };
    if (this._event)
      this._event.diags.push(diag);
    else if (this._segment)
      this._segment.looseDiags.push(diag);
    // pre-segment diags (dispatch preparation) are rare; drop rather than complicate the format
  }

  finalize(opts: { aborted?: boolean; error?: string }): LabRun {
    this._serializePendingRequestBody();
    this._segment = null;
    this._event = null;
    this.run.outcome.aborted = opts.aborted || undefined;
    this.run.outcome.error = opts.error;
    this.run.outcome.durationMs = Date.now() - this._runStart;
    this.run.outcome.ok = !opts.error && !opts.aborted && (this.run.outcome.endReason?.startsWith('done-') ?? false);
    return this.run;
  }


  // internals

  private _beginSegment(requestRef: ChatGenerateDispatch['request']): void {
    this._serializePendingRequestBody();
    this._segmentStart = Date.now();
    this._event = null;
    this._segment = {
      startedAt: this._segmentStart,
      request: { url: requestRef.url, method: requestRef.method },
      events: [],
      looseParticles: [],
      looseDiags: [],
    };
    this._requestRefs.push(requestRef as any);
    this.run.segments.push(this._segment);
  }

  /**
   * Continuations mutate dispatch.request.body after the creator (and thus _beginSegment) ran,
   * so bodies serialize lazily: when the next segment opens, or at run finalize.
   */
  private _serializePendingRequestBody(): void {
    const index = this.run.segments.length - 1;
    if (index < 0) return;
    const ref = this._requestRefs[index];
    if (ref && 'body' in ref && this.run.segments[index].request.body === undefined) {
      try {
        this.run.segments[index].request.body = JSON.parse(JSON.stringify(ref.body));
      } catch {
        this.run.segments[index].request.body = '[unserializable]';
      }
    }
  }

  private _beginEvent(name: string | undefined, eventData: string): LabEvent {
    if (!this._segment)
      throw new Error('TraceRecorder: event before segment');
    const event: LabEvent = {
      i: this._segment.events.length,
      t: Date.now() - this._segmentStart,
      ...(name !== undefined ? { name } : {}),
      size: eventData.length,
      data: _tryParseJson(eventData),
      calls: [],
      particles: [],
      diags: [],
    };
    this._segment.events.push(event);
    this._event = event;
    return event;
  }

}


// -- Console capture (parser diagnostics are console.log/warn based and would otherwise evaporate) --

export async function withConsoleCapture<T>(recorder: TraceRecorder, echo: boolean, fn: () => Promise<T>): Promise<T> {
  const original = { log: console.log, warn: console.warn, error: console.error };
  const intercept = (level: LabDiag['level']) => (...args: unknown[]) => {
    const text = args.map(a => typeof a === 'string' ? a : (() => {
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })()).join(' ');
    recorder.onDiag(level, clampString(text, 4096));
    if (echo) original[level].call(console, ...args);
  };
  console.log = intercept('log');
  console.warn = intercept('warn');
  console.error = intercept('error');
  try {
    return await fn();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
}
