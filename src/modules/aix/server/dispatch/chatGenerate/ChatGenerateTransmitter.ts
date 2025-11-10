import { SERVER_DEBUG_WIRE } from '~/server/wire';
import { serverSideId } from '~/server/trpc/trpc.nanoid';

import type { AixWire_Particles } from '../../api/aix.wiretypes';

import type { IParticleTransmitter, ParticleServerLogLevel } from './parsers/IParticleTransmitter';


// configuration
const ENABLE_EXTRA_DEV_MESSAGES = true;
const DEBUG_REQUEST_MAX_BODY_LENGTH = 100_000;
/**
 * This is enabled by default because probabilistically unlikely -- however there will be false positives/negatives.
 *
 * To activate, one needs a text message with the full `<think>` tag at the beginning of the session. It's likely to
 * happen if the tokenizer has been trained for it, but for general tokenizers (and for now) this escapes.
 */
const LLM_HOTFIX_TRANSFORM_THINKING = true;
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
 * - The aix.router.ts for chatGenerate operations (if called, it's mainly to queue errors)
 *
 * Error handling:
 * - Dialect issues: transmitted by the service (such as OpenAI's .error json fields, or gemini RECITATION) -- [dialect-issue]
 * - RPC issues: the issue is catched in the Aix router at various stages -- [dispatch-prepare, dispatch-fetch, dispatch-read, dispatch-parse]
 *  - Throwing in the IPartTrasmitter portion will be caught by the caller and be re-injected as a [dispatch-parse] issue
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

  // Token stop reason
  private tokenStopReason: AixWire_Particles.GCTokenStopReason | undefined = undefined;

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
    // Metrics: emit at the beginning and the end -- if there's data to transmit
    if (!this.sentMetrics && this.freshMetrics && this.accMetrics) {
      this.sentMetrics = true;
      this.freshMetrics = false;
      this.transmissionQueue.push({
        cg: 'set-metrics',
        metrics: this.accMetrics,
      });
    }

    // Termination
    if (this.terminationReason) {
      const dispatchOrDialectIssue = this.terminationReason === 'issue-dialect' || this.terminationReason === 'issue-rpc';
      this.transmissionQueue.push({
        cg: 'end',
        reason: this.terminationReason,
        tokenStopReason: this.tokenStopReason || (dispatchOrDialectIssue ? 'cg-issue' : 'ok'),
      });
      // Keep this in a terminated state, so that every subsequent call will yield errors (not implemented)
      // this.terminationReason = null;
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

  setRpcTerminatingIssue(issueId: AixWire_Particles.CGIssueId, issueText: string, serverLog: ParticleServerLogLevel) {
    this._addIssue(issueId, issueText, serverLog);
    this.setEnded('issue-rpc');
  }

  addDebugRequest(hideSensitiveData: boolean, url: string, headers: HeadersInit, body?: object) {
    const bodyStr = body === undefined ? '' : JSON.stringify(body, null, 2);

    // ellipsize large bodies (e.g., many base64 images) to avoid huge debug packets
    let processedBody = bodyStr;
    if (bodyStr.length > DEBUG_REQUEST_MAX_BODY_LENGTH) {
      const omittedCount = bodyStr.length - DEBUG_REQUEST_MAX_BODY_LENGTH;
      const ellipsis = `\n...[${omittedCount.toLocaleString()} chars omitted]...\n`;
      const half = Math.floor((DEBUG_REQUEST_MAX_BODY_LENGTH - ellipsis.length) / 2);
      processedBody = bodyStr.slice(0, half) + ellipsis + bodyStr.slice(-half);
    }

    this.transmissionQueue.push({
      cg: '_debugDispatchRequest',
      security: 'dev-env',
      dispatchRequest: {
        url: url,
        headers: hideSensitiveData ? '(hidden sensitive data)' : JSON.stringify(headers, null, 2),
        body: processedBody,
        bodySize: body === undefined ? 0 : JSON.stringify(body).length, // actual size, without pretty-printing or truncation
      },
    });
  }

  addDebugProfilerData(measurements: Record<string, string | number>[]) {
    this.transmissionQueue.push({
      cg: '_debugProfiler',
      measurements,
    });
  }


  /// IPartTransmitter

  /** Set the end reason (NOTE: more comprehensive than just the IPartTransmitter.setEnded['reason'])*/
  setEnded(reason: AixWire_Particles.CGEndReason) {
    if (SERVER_DEBUG_WIRE)
      console.log('|terminate|', reason, this.terminationReason ? `(WARNING: already terminated ${this.terminationReason})` : '');
    this.terminationReason = reason;
  }

  setTokenStopReason(reason: AixWire_Particles.GCTokenStopReason) {
    if (SERVER_DEBUG_WIRE)
      console.log('|token-stop|', reason);
    this.tokenStopReason = reason;
  }

  /**
   * End the current part and flush it
   * - note the default is to NOT log to server, as those are user-facing and not server issues
   */
  setDialectTerminatingIssue(dialectText: string, symbol: string | null, _serverLog: ParticleServerLogLevel = false) {
    this._addIssue('dialect-issue', ` ${symbol || ''} **[${this.prettyDialect} Issue]:** ${dialectText}`, _serverLog);
    this.setEnded('issue-dialect');
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
  appendReasoningText(textChunk: string, weak?: Extract<AixWire_Particles.PartParticleOp, { p: 'tr_' }>['weak']) {
    // NOTE: don't skip on empty chunks, as we want to transition states
    // if there was another Part in the making, queue it
    if (this.currentPart)
      this.endMessagePart();
    this.currentPart = {
      p: 'tr_',
      _t: textChunk,
      ...(weak ? { weak } : {}),
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
          this.appendReasoningText(reasoningText, 'tag');
          this.isThinkingText = false;
          remaining = remaining.substring(closingIdx + '</think>'.length);
          // this is the only branch that can still loop
        } else {
          this.appendReasoningText(remaining, 'tag');
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
  appendImageInline(mimeType: string, base64Data: string, label: string, generator: string, prompt: string): void {
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
    });
    this._queueParticleS();
  }


  /**
   * Undocumented, internal, as the IPartTransmitter callers will call setDialectTerminatingIssue instead
   */
  private _addIssue(issueId: AixWire_Particles.CGIssueId, issueText: string, serverLog: ParticleServerLogLevel) {
    if (serverLog || ENABLE_EXTRA_DEV_MESSAGES || SERVER_DEBUG_WIRE) {
      const logLevel = serverLog === 'srv-warn' ? 'warn' as const : 'log' as const;
      console[logLevel](`Aix.${this.prettyDialect} ${issueId}: ${issueText}`);
    }

    // queue the issue
    this.endMessagePart();
    this.transmissionQueue.push({
      cg: 'issue',
      issueId,
      issueText,
    });
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
  addCodeExecutionInvocation(id: string | null, language: string, code: string, author: 'gemini_auto_inline') {
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
  addCodeExecutionResponse(id: string | null, error: boolean | string, result: string, executor: 'gemini_auto_inline', environment: 'upstream') {
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


  /** Sends control particles right away, such as retry-reset control particles */
  sendControl(cgCOp: AixWire_Particles.ChatControlOp, flushQueue: boolean = true) {
    // queue current particles before sending control particle (interfere with content flow)
    if (flushQueue) this._queueParticleS();
    this.transmissionQueue.push(cgCOp);
  }

  /** Sends a void placeholder particle - temporary status that gets wiped when real content arrives */
  sendVoidPlaceholder(mot: 'search-web' | 'gen-image', text: string) {
    // Don't end message part - placeholders should not interfere with content flow
    this.transmissionQueue.push({
      p: 'vp',
      text,
      mot,
    } satisfies Extract<AixWire_Particles.PartParticleOp, { p: 'vp' }>);
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

  /** Communicates the upstream response handle, for remote control/resumability */
  setUpstreamHandle(handle: string, _type: 'oai-responses' /* the only one for now, used for type safety */) {
    if (SERVER_DEBUG_WIRE)
      console.log('|response-handle|', handle);
    // NOTE: if needed, we could store the handle locally for server-side resumability, but we just implement client-side (correction, manual) for now
    this.transmissionQueue.push({
      cg: 'set-upstream-handle',
      handle: {
        uht: 'vnd.oai.responses',
        responseId: handle,
        expiresAt: Date.now() + 30 * 24 * 3600 * 1000, // default: 30 days expiry
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
