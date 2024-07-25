import { SERVER_DEBUG_WIRE } from '~/server/wire';
import { serverSideId } from '~/server/api/trpc.nanoid';

import type { AixWire_Particles } from '../../api/aix.wiretypes';

import type { IParticleTransmitter } from './IParticleTransmitter';


// configuration
const ENABLE_EXTRA_DEV_MESSAGES = true;
export const IssueSymbols = {
  Generic: '❌',
  PromptBlocked: '🚫',
  Recitation: '🦜',
  GenMaxTokens: '🧱',
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

  // Counters
  private accCounts: AixWire_Particles.ChatGenerateCounts | undefined = undefined;
  private sentCounts: boolean = false;
  private freshCounts: boolean = false;

  // Termination
  private terminationReason: AixWire_Particles.CGEndReason | null /* if reset (not impl.) */ | undefined = undefined;


  constructor(private readonly prettyDialect: string, _throttleTimeMs: number | undefined) {
    // TODO: implement throttling on a particle basis
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
    // Counters: emit at the beginning and the end -- if there's data to transmit
    if (!this.sentCounts && this.freshCounts && this.accCounts) {
      this.sentCounts = true;
      this.freshCounts = false;
      this.transmissionQueue.push({
        cg: 'update-counts',
        counts: this.accCounts,
      });
    }

    // Termination
    if (this.terminationReason) {
      this.transmissionQueue.push({
        cg: 'end',
        reason: this.terminationReason,
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
    this.sentCounts = false; // enable sending counters again
    return yield* this.emitParticles();
  }

  get isEnded() {
    return !!this.terminationReason;
  }

  setRpcTerminatingIssue(issueId: AixWire_Particles.CGIssueId, issueText: string, forceLogWarn: boolean) {
    this._addIssue(issueId, issueText, forceLogWarn);
    this.setEnded('issue-rpc');
  }

  addDebugRequestInDev(url: string, headers: HeadersInit, body: object) {
    // [security] only emit in development, as it may contain sensitive information
    if (process.env.NODE_ENV !== 'development') return;
    this.transmissionQueue.push({
      _debug: 'request',
      security: 'dev-env',
      request: {
        url,
        headers: JSON.stringify(headers, null, 2),
        body: JSON.stringify(body, null, 2),
      },
    });
  }


  /// IPartTransmitter

  /** Set the end reason (NOTE: more comprehensive than just the IPartTransmitter.setEnded['reason'])*/
  setEnded(reason: AixWire_Particles.CGEndReason) {
    if (SERVER_DEBUG_WIRE)
      console.log('|terminate|', reason, this.terminationReason ? `(WARNING: already terminated ${this.terminationReason})` : '');
    this.terminationReason = reason;
  }

  /** End the current part and flush it */
  setDialectTerminatingIssue(dialectText: string, symbol: string | null) {
    this._addIssue('dialect-issue', ` ${symbol || ''} **[${this.prettyDialect} Issue]:** ${dialectText}`, false);
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

  /** Undocumented, internal, as the IPartTransmitter callers will call setDialectTerminatingIssue instead */
  private _addIssue(issueId: AixWire_Particles.CGIssueId, issueText: string, forceLogWarn: boolean) {
    if (forceLogWarn || ENABLE_EXTRA_DEV_MESSAGES || SERVER_DEBUG_WIRE)
      console.warn(`Aix.${this.prettyDialect} (${issueId}): ${issueText}`);

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

  /** Communicates the model name to the client */
  setModelName(modelName: string) {
    this.transmissionQueue.push({
      cg: 'set-model',
      name: modelName,
    });
  }

  /** Update the counters, sent twice (after the first call, and then at the end of the transmission) */
  setCounters(counts: AixWire_Particles.ChatGenerateCounts) {
    if (!this.accCounts)
      this.accCounts = {};

    // similar to Object.assign, but takes care of removing the "undefined" entries
    for (const key in counts) {
      const value = (counts as any)[key] as number | undefined;
      if (value !== undefined)
        (this.accCounts as any)[key] = value;
    }

    this.freshCounts = true;
  }

}
