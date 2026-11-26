import { SERVER_DEBUG_WIRE } from '~/server/wire';
import { serverSideId } from '~/server/trpc/trpc.nanoid';

import { objectDeepCloneWithStringLimit, objectEstimateJsonSize, objectStringifyWithIndentDepth } from '~/common/util/objectUtils';

import { AixWire_Particles } from '../../api/aix.wiretypes';
import { aixIssue, aixIssueFails, aixIssuePlainText, type DAixIssue } from '../../../shared/aix.issues';

import type { IParticleTransmitter, ParticleCGControlOp, ParticleCGDialectEndReason, ParticleDialectIssue, ParticleServerLogLevel } from './parsers/IParticleTransmitter';


// configuration
const ENABLE_EXTRA_DEV_MESSAGES = true;
const DEBUG_REQUEST_MAX_STRING_BYTES = 2048;

// query-string credentials (Gemini's `?key=`, and anything named like one) never reach the client
const DEBUG_REQUEST_URL_SECRET_PARAMS = new Set(['key', 'api_key', 'apikey', 'api-key', 'token', 'access_token', 'sig', 'signature']);

function _redactUrlSecrets(url: string): string {
  try {
    const parsed = new URL(url);
    let redacted = false;
    for (const name of [...parsed.searchParams.keys()])
      if (DEBUG_REQUEST_URL_SECRET_PARAMS.has(name.toLowerCase())) {
        parsed.searchParams.set(name, 'hidden');
        redacted = true;
      }
    return redacted ? parsed.toString() : url;
  } catch {
    return url.split('?')[0]; // unparsable: drop the whole query string
  }
}

/**
 * This is enabled by default because probabilistically unlikely -- however there will be false positives/negatives.
 *
 * To activate, one needs a text message with the full `<think>` tag at the beginning of the session. It's likely to
 * happen if the tokenizer has been trained for it, but for general tokenizers (and for now) this escapes.
 */
const LLM_HOTFIX_TRANSFORM_THINKING = true;

/** [Aix.Issue shim] unused by the records: here until the parsers stop passing them */
export const IssueSymbols = {
  Generic: '❌',
  PromptBlocked: '🚫',
  Recitation: '🦜',
  Language: '🌐',
};


/**
 * Queues up and emits small messages (particles) to the client, for the purpose of a stateful
 * full reconstruction of the AixWire_Parts[] objects.
 *
 * Called by:
 * - The current dispatch chatGenerate parser, for transmitting multi-modal and multi-part messages to the client
 * - The executor, for its own issues and the end
 *
 * Issues (aix.issues.ts): each is queued where it arrives, as an `aix-issue` particle, and never held back. Rules:
 * - at most one issue fails a generation: after a failure, or after a clean or truncated stop reason, a failure is a notice
 * - a failure travels with an error-class stop reason: the parser's own (a filter), else 'cg-issue'; a clean one is then refused
 * - adding an issue does not stop the read: setDialectEnded / setDispatchEnded do
 * - the end is sent once, last: before it, the issues only the end can tell (_queueEndIssues); nothing follows it
 * - a parser's throw is caught by the executor and becomes a `dispatch-parse` issue
 */
export class ChatGenerateTransmitter implements IParticleTransmitter {

  // Particle queue
  private currentText: AixWire_Particles.TextParticleOp | null = null;
  private currentPart: AixWire_Particles.PartParticleOp | null = null;
  private transmissionQueue: AixWire_Particles.ChatGenerateOp[] = [];

  // State machinery
  private lastFunctionCallParticle: Extract<AixWire_Particles.PartParticleOp, { p: 'fci' }> | null = null;
  private isThinkingText: boolean | undefined = !LLM_HOTFIX_TRANSFORM_THINKING ? false : undefined;

  // Termination
  private terminationReason: AixWire_Particles.CGEndReason | null /* if reset (not impl.) */ | undefined = undefined;
  private endQueued: boolean = false; // the end particle was queued: nothing follows it

  // Token stop reason
  private tokenStopReason: AixWire_Particles.GCTokenStopReason | undefined = undefined;
  private shimStopText: string | undefined = undefined; // [Aix.Issue shim] the text a parser sent with its stop reason, stated at the end

  // Issues
  private failedQueued: boolean = false; // an issue that failed the generation was queued

  // Metrics
  private accMetrics: AixWire_Particles.CGSelectMetrics | undefined = undefined;
  private sentMetrics: boolean = false;
  private freshMetrics: boolean = false;


  constructor(private readonly prettyDialect: string /*, _throttleTimeMs: number | undefined */) {
    // TODO: implement throttling on a particle basis

    // Not really used for now
    // this.transmissionQueue.push({
    //   cg: 'start',
    // });
  }

  private _queueParticleS() {
    if (this.currentText) {
      this.transmissionQueue.push(this.currentText);
      this.currentText = null;
    }
    if (this.currentPart) {
      this.transmissionQueue.push(this.currentPart);
      this.currentPart = null;
    }
  }


  /// aix.router.ts

  * emitParticles(): Generator<AixWire_Particles.ChatGenerateOp> {
    // After the end: nothing more goes out
    if (this.endQueued) {
      if (this.transmissionQueue.length)
        console.warn(`[Aix.${this.prettyDialect}] emitParticles: dropping ${this.transmissionQueue.length} particle(s) queued after the end`);
      this.transmissionQueue = [];
      return;
    }

    // Termination, 1/2: the issues only the end can tell, before the final metrics
    if (this.terminationReason)
      this._queueEndIssues();

    // Metrics: emit at the beginning and the end -- if there's data to transmit
    if (!this.sentMetrics && this.freshMetrics && this.accMetrics) {
      this.sentMetrics = true;
      this.freshMetrics = false;
      this.transmissionQueue.push({
        cg: 'set-metrics',
        metrics: this.accMetrics,
      });
    }

    // Termination, 2/2: the end, once, last; facts only
    if (this.terminationReason) {
      this.endQueued = true;
      this.transmissionQueue.push({
        cg: 'end',
        terminationReason: this.terminationReason,
        tokenStopReason: this.tokenStopReason,
      });
    }

    // Emit queued particles
    for (const op of this.transmissionQueue)
      yield op;
    this.transmissionQueue = [];
  }

  * flushParticles(): Generator<AixWire_Particles.ChatGenerateOp> {
    this._queueParticleS();
    this.sentMetrics = false; // enable sending metrics again
    return yield* this.emitParticles();
  }

  get isEnded() {
    return !!this.terminationReason;
  }

  /** The service closed the body with no end from the dialect: how some dialects finish, a cutoff for one that always sends a final event */
  get isClosedWithoutEnd(): boolean {
    return this.terminationReason === 'done-dispatch-closed';
  }

  get hasExplicitTokenStopReason(): boolean {
    return this.tokenStopReason !== undefined;
  }


  addDebugRequest(hideSensitiveData: boolean, url: string, headers: HeadersInit, body?: object) {
    // Ellipsize individual strings in the body object (e.g., base64 images) to reduce debug packet size
    const ellipsizedBody = body ? objectDeepCloneWithStringLimit(body, 'aix.addDebugRequest', DEBUG_REQUEST_MAX_STRING_BYTES) : undefined;
    const processedBody = ellipsizedBody ? objectStringifyWithIndentDepth(ellipsizedBody, 'aix.addDebugRequest', 4, 2) : '';

    this.transmissionQueue.push({
      cg: '_debugDispatchRequest',
      security: 'dev-env',
      dispatchRequest: {
        url: hideSensitiveData ? _redactUrlSecrets(url) : url,
        headers: hideSensitiveData ? '(hidden sensitive data)' : JSON.stringify(headers, null, 2),
        body: processedBody,
        bodySize: body ? objectEstimateJsonSize(body, 'aix.addDebugRequest') : 0,
      },
    });
  }

  addDebugProfilerData(measurements: Record<string, string | number>[]) {
    this.transmissionQueue.push({
      cg: '_debugProfiler',
      measurements,
    });
  }


  /// Dispatch termination

  /** Set the end reason (NOTE: does not overlap with dialect-initiated end: IParticleTransmitter.setDialectEnded['reason']) */
  setDispatchEnded(reason: Extract<AixWire_Particles.CGEndReason,
    | 'done-dispatch-closed'    // stream ended
    | 'done-dispatch-aborted'   // stream aborted (abort signal)
    | 'issue-dispatch-rpc'      // issues in one of 4 dispatch stages: prepare, fetch, read, parse - see below
  >) {
    if (SERVER_DEBUG_WIRE)
      console.log('|terminate-dispatch|', reason, this.terminationReason ? `(WARNING: already terminated ${this.terminationReason})` : '');
    if (this.terminationReason)
      console.warn(`[Aix.${this.prettyDialect}] setDispatchEnded('${reason}'): already terminated with reason '${this.terminationReason}' (overriding)`);
    this.terminationReason = reason;
  }

  /** Queue the record of a failed executor stage (`dispatch-*`) and end with 'issue-dispatch-rpc' */
  setDispatchRpcTerminatingIssue(issue: DAixIssue, serverLog: ParticleServerLogLevel) {
    this.addIssue(issue, serverLog);
    this.setDispatchEnded('issue-dispatch-rpc');
  }


  /// IPartTransmitter

  setDialectEnded(reason: ParticleCGDialectEndReason) {
    if (SERVER_DEBUG_WIRE)
      console.log('|terminate-dialect|', reason, this.terminationReason ? `(WARNING: already terminated ${this.terminationReason})` : '');
    if (this.terminationReason)
      console.warn(`[Aix.${this.prettyDialect}] setDialectEnded('${reason}'): already terminated with reason '${this.terminationReason}' (overriding)`);
    this.terminationReason = reason;
  }

  /** An issue the parser states; the default is to NOT log to server, as those are user-facing and not server issues */
  addDialectIssue(issue: ParticleDialectIssue, serverLog: ParticleServerLogLevel = false): void {
    const { code = 'service-error', effect = code === 'service-tool' ? 'lost' : 'failed', text, detail, causeCode, retryAfterMs } = issue;
    this.addIssue(aixIssue(code, effect, {
      // a filter the parser has no words for is explained by its stop reason
      text: text || (code === 'model-filter' ? AixWire_Particles.gcStopReasonRow(this.tokenStopReason ?? '')?.message : undefined),
      detail, causeCode, retryAfterMs,
    }), serverLog);
  }

  /** [Aix.Issue shim] the pre-record call: an issue that fails, then the end */
  setDialectTerminatingIssue(dialectText: string, _symbol: string | null, serverLog: ParticleServerLogLevel = false) {
    this.addDialectIssue({ text: dialectText }, serverLog);
    this.setDialectEnded('issue-dialect');
  }

  setTokenStopReason(reason: AixWire_Particles.GCTokenStopReason, shimErrorText?: string) {
    if (SERVER_DEBUG_WIRE)
      console.log('|token-stop|', reason, shimErrorText ?? '');

    // a generation that failed cannot finish clean
    if (this.failedQueued && AixWire_Particles.gcStopReasonRow(reason)?.class !== 'error') {
      console.warn(`[Aix.${this.prettyDialect}] setTokenStopReason('${reason}'): ignored, an issue already failed the generation (stop reason '${this.tokenStopReason}')`);
      return;
    }

    if (this.tokenStopReason && this.tokenStopReason !== reason)
      console.warn(`[Aix.${this.prettyDialect}] setTokenStopReason('${reason}'): already has token stop reason '${this.tokenStopReason}' (overriding)`);
    this.tokenStopReason = reason;
    this.shimStopText = shimErrorText || undefined; // last wins: a later stop reason drops the text of an earlier one (#1288)
  }


  /** Closes the current part, also flushing it out */
  endMessagePart() {
    // signals that the part has ended and should be transmitted
    this._queueParticleS();
    // the following are set above
    // this.currentText = null;
    // this.currentPart = null;
    this.lastFunctionCallParticle = null;
    // Note: should set some sending flag or something
  }

  /** Appends text, creating a part if missing [throttled] */
  appendText(textChunk: string) {
    // if there was another Part in the making, queue it
    if (this.currentPart)
      this.endMessagePart();
    this.currentText = {
      t: textChunk,
    };
    // [throttle] send it immediately for now
    this._queueParticleS();
  }

  /** Appends reasoning text, which is its own kind of content */
  appendReasoningText(textChunk: string, options?: { weak?: 'tag', restart?: boolean }) {
    // NOTE: don't skip on empty chunks, as we want to transition states
    // if there was another Part in the making, queue it
    if (this.currentPart)
      this.endMessagePart();
    this.currentPart = {
      p: 'tr_',
      _t: textChunk,
      ...(options?.weak ? { weak: options.weak } : {}),
      ...(options?.restart ? { restart: true } : {}),
    };
    // [throttle] send it immediately for now
    this._queueParticleS();
  }

  /** Sets a reasoning signature, associated with the current reasoning text */
  setReasoningSignature(signature: string): void {
    this.endMessagePart();
    this.currentPart = {
      p: 'trs',
      signature,
    };
    this._queueParticleS();
  }

  /** Adds a raw (redacted) reasoning data parcel */
  addReasoningRedactedData(data: string): void {
    this.endMessagePart();
    this.currentPart = {
      p: 'trr_',
      _data: data,
    };
    this._queueParticleS();
  }

  /**
   * Support function to extract potential reasoning text in between <think> and </think> tags,
   * if and only if it's the very first text in the whole session.
   */
  appendAutoText_weak(textChunk: string) {
    // fast-path
    if (this.isThinkingText === false) {
      this.appendText(textChunk);
      return;
    }

    // inspect only at the very beginning
    let remaining = textChunk;
    if (this.isThinkingText === undefined) {
      const trimmed = remaining.trimStart();
      if (trimmed.startsWith('<think>')) {
        this.isThinkingText = true;
        remaining = trimmed.substring('<think>'.length);
      } else
        this.isThinkingText = false;  // or never use thinking extraction
    }

    while (remaining.length > 0) {
      if (this.isThinkingText) {
        const closingIdx = remaining.indexOf('</think>');
        if (closingIdx >= 0) {
          const reasoningText = remaining.substring(0, closingIdx);
          this.appendReasoningText(reasoningText, { weak: 'tag' });
          this.isThinkingText = false;
          remaining = remaining.substring(closingIdx + '</think>'.length);
          // this is the only branch that can still loop
        } else {
          this.appendReasoningText(remaining, { weak: 'tag' });
          return;
        }
      } else {
        this.appendText(remaining);
        return;
      }
    }
  }


  /** Appends an audio file generated by the model */
  appendAudioInline(mimeType: string, base64Data: string, label: string, generator: string, durationMs: number): void {
    // audio is a breaking content part
    this.endMessagePart();

    // enqueue and send right away as it's a large part
    this.transmissionQueue.push({
      p: 'ia',  // inline audio
      mimeType,
      a_b64: base64Data,
      ...(label ? { label } : {}),
      ...(generator ? { generator } : {}),
      ...(durationMs ? { durationMs } : {}),
    });
    this._queueParticleS();
  }

  /** Appends an image generated by the model */
  appendImageInline(mimeType: string, base64Data: string, label: string, generator: string, prompt: string, hintSkipResize?: boolean): void {
    // images are a breaking content part
    this.endMessagePart();

    // enqueue and send right away as it's a large part
    this.transmissionQueue.push({
      p: 'ii',  // inline image
      mimeType,
      i_b64: base64Data,
      ...(label ? { label } : {}),
      ...(generator ? { generator } : {}),
      ...(prompt ? { prompt } : {}),
      ...(hintSkipResize ? { hintSkipResize } : {}),
    });
    this._queueParticleS();
  }

  /** Appends a video generated by the model (EXPERIMENTAL: Gemini Omni; client plays it in-memory, not persisted) */
  appendVideoInline(mimeType: string, base64Data: string, label: string, generator: string): void {
    // video is a breaking content part
    this.endMessagePart();

    // enqueue and send right away as it's a large part
    this.transmissionQueue.push({
      p: 'iv',  // inline video
      mimeType,
      v_b64: base64Data,
      ...(label ? { label } : {}),
      ...(generator ? { generator } : {}),
    });
    this._queueParticleS();
  }

  /** Appends a hosted resource (e.g. Anthropic container file) - inline content between text fragments */
  appendHostedResource(hres: Extract<AixWire_Particles.PartParticleOp, { p: 'hres' }>) {
    this.endMessagePart();
    this.transmissionQueue.push(hres);
  }

  /** Appends a void notice - inline between text fragments, display-only */
  appendVoidNotice(vnt: Extract<AixWire_Particles.PartParticleOp, { p: 'vnt' }>) {
    this.endMessagePart();
    this.transmissionQueue.push(vnt);
  }


  /**
   * Queue an issue record (aix.issues.ts): it closes the open part and goes out at once, as an `aix-issue` particle.
   * After the verdict (a clean or truncated stop reason, an earlier failure) a failure changes nothing of the response:
   * it is stamped a notice. An issue that fails sets the stop reason to 'cg-issue', unless an error-class one is set.
   */
  addIssue(issue: DAixIssue, serverLog: ParticleServerLogLevel): void {
    const verdictIn = this.failedQueued || (this.tokenStopReason !== undefined && AixWire_Particles.gcStopReasonRow(this.tokenStopReason)?.class !== 'error');
    if (verdictIn && aixIssueFails(issue))
      issue = { ...issue, effect: 'notice' };

    if (serverLog || ENABLE_EXTRA_DEV_MESSAGES || SERVER_DEBUG_WIRE) {
      const logLevel = serverLog === 'srv-warn' ? 'warn' as const : 'log' as const;
      console[logLevel](`Aix.${this.prettyDialect} ${issue.code} (${issue.effect}): ${aixIssuePlainText(issue)}`, { causeCode: issue.causeCode, httpStatus: issue.httpStatus });
    }

    if (aixIssueFails(issue)) {
      this.failedQueued = true;
      if (AixWire_Particles.gcStopReasonRow(this.tokenStopReason ?? '')?.class !== 'error')
        this.tokenStopReason = 'cg-issue';
    }

    this.endMessagePart();
    this.transmissionQueue.push({ cg: 'aix-issue', issue });
  }

  /**
   * The issues only the end can tell, from the final end reason and stop reason: nets, for what no producer explained.
   * At most one applies; none once an issue failed the generation.
   */
  private _queueEndIssues(): void {
    // [Aix.Issue shim] the text a parser sent with its stop reason
    if (this.shimStopText)
      this.addIssue(aixIssue(this.tokenStopReason?.startsWith('filter-') ? 'model-filter' : 'service-error', 'failed', { text: this.shimStopText }), false);
    if (this.failedQueued) return;
    const reason = this.terminationReason, stop = this.tokenStopReason;

    // a filter stop the parser did not explain: the stop reason's own sentence
    if (stop?.startsWith('filter-'))
      return this.addIssue(aixIssue('model-filter', 'failed', { text: AixWire_Particles.gcStopReasonRow(stop)?.message }), false);
    // the read closed with no stop reason; with one, the close is how that dialect ends
    if (reason === 'done-dispatch-closed' && !stop)
      return this.addIssue(aixIssue('dispatch-cutoff', 'failed'), 'srv-warn');
    // the abort signal fired with no stop reason: under a user Stop nobody reads this, else it is the failure
    if (reason === 'done-dispatch-aborted' && !stop)
      return this.addIssue(aixIssue('dispatch-aborted', 'failed'), false);
    // an end that fails with no issue: no failure without an explanation
    if (stop === 'cg-issue' || (!stop && (reason === 'issue-dialect' || reason === 'issue-dispatch-rpc')))
      return this.addIssue(aixIssue('service-error', 'failed'), 'srv-warn');
    // the dialect ended without a stop reason: completeness unknown
    if (reason === 'done-dialect' && !stop)
      this.addIssue(aixIssue('model-unfinished', 'notice'), false);
  }

  /**
   * Creates a FC part, flushing the previous one if needed, and starts adding data to it
   * @param id if null [Gemini], a new id will be generated to keep it linked to future tool responses
   * @param functionName required.
   * @param expectedArgsFmt 'incr_str' | 'json_object' - 'incr_str' for incremental string, 'json_object' for JSON object
   * @param args must be undefined, or match the expected Args Format
   */
  startFunctionCallInvocation(id: string | null, functionName: string, expectedArgsFmt: 'incr_str' | 'json_object', args: string | object | null) {
    // validate state
    if (this.currentPart?.p === 'fci')
      throw new Error('Cannot start a new function call while the previous one is still open [parser-logic]');
    if (!functionName) {
      console.warn(`Aix.${this.prettyDialect}: function call missing name, using fallback`);
      functionName = 'unknown_function';
    }

    this.endMessagePart();
    this.currentPart = {
      p: 'fci',
      id: id ?? serverSideId('aix-tool-call-id'),
      name: functionName,
    };
    if (args) {
      if ((typeof args === 'string' && expectedArgsFmt !== 'incr_str') || (typeof args === 'object' && expectedArgsFmt !== 'json_object'))
        throw new Error(`unexpected argument format: got '${typeof args}' instead of '${expectedArgsFmt}'`);
      this.currentPart.i_args = typeof args === 'string' ? args : JSON.stringify(args);
    }
    this.lastFunctionCallParticle = this.currentPart;
    this._queueParticleS();
  }

  /** Appends data to a FC part [throttled] */
  appendFunctionCallInvocationArgs(id: string | null, argsJsonChunk: string) {
    // we expect the last function call to be open
    if (this.lastFunctionCallParticle?.p !== 'fci')
      throw new Error('function-call-tool: cannot append arguments to a non-existing function call');

    // we expect the id to match, if provided
    if (id && id !== this.lastFunctionCallParticle.id)
      throw new Error('function-call-tool: arguments id mismatch');

    // transmit the arguments
    // [throttle] this is where we could operate to accumulate the arguments
    this._queueParticleS();
    this.currentPart = {
      p: '_fci',
      _args: argsJsonChunk,
    };
    this._queueParticleS();
  }

  /** Creates a CE request part, flushing the previous one if needed, and completes it */
  addCodeExecutionInvocation(id: string | null, language: string, code: string, author: 'gemini_auto_inline' | 'code_interpreter') {
    this.endMessagePart();
    this.transmissionQueue.push({
      p: 'cei',
      id: id ?? serverSideId('aix-tool-call-id'),
      language,
      code,
      author,
    });
  }

  /** Creates a CE result part, flushing the previous one if needed, and completes it */
  addCodeExecutionResponse(id: string | null, error: boolean | string, result: string, executor: 'gemini_auto_inline' | 'code_interpreter', environment: 'upstream') {
    this.endMessagePart();
    this.transmissionQueue.push({
      p: 'cer',
      id: id ?? serverSideId('aix-tool-response-id'),
      error,
      result,
      executor,
      environment,
    });
  }

  /** Creates a CE result part, flushing the previous one if needed, and completes it */
  appendUrlCitation(title: string, url: string, citationNumber?: number, startIndex?: number, endIndex?: number, textSnippet?: string, pubTs?: number) {
    this.endMessagePart();
    this.transmissionQueue.push({
      p: 'urlc',
      title,
      url,
      ...(citationNumber !== undefined ? { num: citationNumber } : {}),
      ...(startIndex !== undefined ? { from: startIndex } : {}),
      ...(endIndex !== undefined ? { to: endIndex } : {}),
      ...(textSnippet ? { text: textSnippet } : {}),
      ...(pubTs !== undefined ? { pubTs } : {}),
    } satisfies Extract<AixWire_Particles.PartParticleOp, { p: 'urlc' }>);
  }


  /** Sends control particles right away, such as aix-info/aix-retry-reset/... control particles */
  sendCGControl(cgCOp: ParticleCGControlOp, flushQueue: boolean = true) {
    // queue current particles before sending control particle (interfere with content flow)
    if (flushQueue) this._queueParticleS();
    this.transmissionQueue.push(cgCOp);
  }

  /** Sends an operation status particle - temporary progress with operation tracking */
  sendOperationState(
    mot: 'search-web' | 'gen-image' | 'code-exec', text: string,
    opts: { opId: string, state?: 'done' | 'error', parentOpId?: string, iTexts?: string[], oTexts?: string[] },
  ) {
    // Don't end message part - operation status should not interfere with content flow
    this.transmissionQueue.push({
      p: 'vp',
      mot,
      opId: opts.opId,
      text,
      ...opts.state ? { state: opts.state } : undefined,
      ...opts.parentOpId ? { parentOpId: opts.parentOpId } : undefined,
      ...opts.iTexts?.length ? { iTexts: opts.iTexts } : undefined,
      ...opts.oTexts?.length ? { oTexts: opts.oTexts } : undefined,
    } satisfies Extract<AixWire_Particles.PartParticleOp, { p: 'vp' }>);
  }

  /**
   * Sends vendor-specific state modifier for the last emitted part.
   * This attaches opaque protocol state (e.g., Gemini thoughtSignature) without polluting core part schemas.
   */
  sendSetVendorState(svs: Extract<AixWire_Particles.PartParticleOp, { p: 'svs' }>) {
    // queue vendor state particle immediately after the content part has been queued (and if text, it will be emitted sooner anyway)
    this.transmissionQueue.push(svs);
  }

  /** Communicates the model name to the client */
  setModelName(modelName: string) {
    this.transmissionQueue.push({
      cg: 'set-model',
      name: modelName,
    });
    // send it right away if there's no other content (this may be the first particle)
    if (this.currentPart === null && this.currentText === null)
      this._queueParticleS();
  }

  /** Communicates the provider name to the client (e.g., OpenRouter provider routing) */
  setProviderInfraLabel(label: string) {
    this.transmissionQueue.push({
      cg: 'set-provider-infra',
      label: label,
    });
  }

  /** Communicates the upstream response handle, for remote control/resumability */
  setUpstreamHandle(handle: string, type: 'vnd.oai.responses' | 'vnd.gem.interactions') {
    if (SERVER_DEBUG_WIRE)
      console.log('|response-handle|', type, handle);
    // NOTE: if needed, we could store the handle locally for server-side resumability, but we just implement client-side (correction, manual) for now
    // createdAt/expiresAt are server-clock at emit time; on reattach the server has no knowledge of the original create,
    // so it emits fresh values. The client reassembler preserves the earliest values for a given runId.
    const now = Date.now();
    const expireDays = type === 'vnd.gem.interactions'
      ? 1 // Gemini Interactions: 1d free / 55d paid - use the conservative lower bound
      : 30; // OpenAI Responses: default 30 days
    this.transmissionQueue.push({
      cg: 'set-upstream-handle',
      handle: {
        uht: type,
        runId: handle,
        createdAt: now,
        expiresAt: now + expireDays * 24 * 3600 * 1000,
      },
    });
    // send it right away, in case the connection closes soon
    this._queueParticleS();
  }

  /** Update the metrics, sent twice (after the first call, and then at the end of the transmission) */
  updateMetrics(update: Partial<AixWire_Particles.CGSelectMetrics>) {
    if (!this.accMetrics)
      this.accMetrics = {};

    // similar to Object.assign, but takes care of removing the "undefined" entries
    for (const key in update) {
      const value = (update as any)[key] as number | undefined;
      if (value !== undefined)
        (this.accMetrics as any)[key] = value;
    }

    this.freshMetrics = true;
  }

}
