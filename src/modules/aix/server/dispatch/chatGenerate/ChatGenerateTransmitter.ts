import { SERVER_DEBUG_WIRE } from '~/server/wire';
import { serverSideId } from '~/server/api/trpc.nanoid';

import type { AixAPI_Particles } from '../../api/aix.wiretypes';

import type { IPartTransmitter } from './IPartTransmitter';


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
export class ChatGenerateTransmitter implements IPartTransmitter {

  // Particle queue
  private currentParticle: AixAPI_Particles.ParticleOp | null = null;
  private transmissionQueue: AixAPI_Particles.ChatGenerateOp[] = [];

  // State machinery
  private lastFunctionCallParticle: AixAPI_Particles.ParticleOp | null = null;

  // Counters
  private accCounts: AixAPI_Particles.ChatGenerateCounts | undefined = undefined;
  private sentCounts: boolean = false;
  private freshCounts: boolean = false;

  // Termination
  private terminationReason: AixAPI_Particles.CGEndReason | null /* if reset (not impl.) */ | undefined = undefined;


  constructor(private readonly prettyDialect: string, _throttleTimeMs: number | undefined) {
    // TODO: implement throttling on a particle basis
  }

  private _queueParticle() {
    if (this.currentParticle) {
      this.transmissionQueue.push(this.currentParticle);
      this.currentParticle = null;
    }
  }


  /// aix.router.ts

  * emitParticles(): Generator<AixAPI_Particles.ChatGenerateOp> {
    // Counters: emit at the beginning and the end -- if there's data to transmit
    if (!this.sentCounts && this.freshCounts && this.accCounts) {
      this.sentCounts = true;
      this.freshCounts = false;
      yield {
        cg: 'update-counts',
        counts: this.accCounts,
      };
    }

    // Queued operations
    for (const op of this.transmissionQueue)
      yield op;
    this.transmissionQueue = [];

    // Termination
    if (this.terminationReason) {
      yield {
        cg: 'end',
        reason: this.terminationReason,
      };
      // Keep this in a terminated state, so that every subsequent call will yield errors
      // this.terminationReason = null;
    }
  }

  * flushParticles(): Generator<AixAPI_Particles.ChatGenerateOp> {
    this._queueParticle();
    this.sentCounts = false; // enable sending counters again
    return yield* this.emitParticles();
  }

  get isEnded() {
    return !!this.terminationReason;
  }

  setRpcTerminatingIssue(issueId: AixAPI_Particles.CGIssueId, issueText: string, forceLogWarn: boolean) {
    this._addIssue(issueId, issueText, forceLogWarn);
    this.setEnded('issue-rpc');
  }


  /// IPartTransmitter

  /** Set the end reason (NOTE: more comprehensive than just the IPartTransmitter.setEnded['reason'])*/
  setEnded(reason: AixAPI_Particles.CGEndReason) {
    if (SERVER_DEBUG_WIRE)
      console.log('|terminate|', reason, this.terminationReason ? `(WARNING: already terminated ${this.terminationReason})` : '');
    this.terminationReason = reason;
  }

  /** End the current part and flush it */
  setDialectTerminatingIssue(dialectText: string, symbol?: string) {
    this._addIssue('dialect-issue', ` ${symbol} **[${this.prettyDialect} Issue]:** ${dialectText}`, false);
    this.setEnded('issue-dialect');
  }

  /** Closes the current part, also flushing it out */
  endMessagePart() {
    // signals that the part has ended and should be transmitted
    this._queueParticle();
    this.lastFunctionCallParticle = null;
    // Note: should set some sending flag or something
  }

  /** Undocumented, internal, as the IPartTransmitter callers will call setDialectTerminatingIssue instead */
  private _addIssue(issueId: AixAPI_Particles.CGIssueId, issueText: string, forceLogWarn: boolean) {
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

  /** Appends text, creating a part if missing [throttled] */
  appendText(text: string) {
    if (this.currentParticle) {
      // [throttle] Note: this is where throttling would be implemented
      this._queueParticle();
    }
    this.currentParticle = {
      p: 't_',
      t: text,
    };
    this._queueParticle();
  }

  /**
   * Creates a FC part, flushing the previous one if needed, and starts adding data to it
   * @param id if null [Gemini], a new id will be generated to keep it linked to future tool responses
   * @param functionName required.
   * @param expectedArgsFmt 'incr_str' | 'json_object' - 'incr_str' for incremental string, 'json_object' for JSON object
   * @param args must be undefined, or match the expected Args Format
   */
  startFunctionToolCall(id: string | null, functionName: string, expectedArgsFmt: 'incr_str' | 'json_object', args?: string | object | null) {
    if (this.currentParticle?.p === 'function-call')
      throw new Error('Cannot start a new function call while the previous one is still open [parser-logic]');
    this._queueParticle();
    this.currentParticle = {
      p: 'function-call',
      id: id ?? serverSideId('aix-tool-call-id'),
      name: functionName,
    };
    if (args) {
      if (expectedArgsFmt === 'incr_str') {
        if (ENABLE_EXTRA_DEV_MESSAGES && typeof args !== 'string')
          console.warn(`ChatGenerateTransmitter.startFunctionToolCall (${this.prettyDialect}): Expected string args for incremental string, got`, typeof args, args);
        this.currentParticle.i_args = typeof args === 'string' ? args : JSON.stringify(args);
      } else if (expectedArgsFmt === 'json_object') {
        if (ENABLE_EXTRA_DEV_MESSAGES && typeof args !== 'object')
          console.warn(`ChatGenerateTransmitter.startFunctionToolCall (${this.prettyDialect}): Expected object args for JSON object, got`, typeof args, args);
        this.currentParticle.i_args = JSON.stringify(args);
      } else
        throw new Error(`Unexpected function call argument format: '${expectedArgsFmt}'`);
    }
    // [throttle] Note: for throttling, we may keep this one open for longer instead
    this.lastFunctionCallParticle = this.currentParticle;
    this._queueParticle();
  }

  /** Appends data to a FC part [throttled] */
  appendFunctionToolCallArgsIStr(id: string | null, argsJsonChunk: string) {
    // we expect the last function call to be open
    if (this.lastFunctionCallParticle?.p !== 'function-call')
      throw new Error('ChatGenerateTransmitter: cannot process function call arguments while no function call is open');

    // we expect the id to match, if provided
    if (id && this.lastFunctionCallParticle.id !== id)
      throw new Error(`ChatGenerateTransmitter: cannot append function call arguments to a different function call: ${id} !== ${this.lastFunctionCallParticle.id}`);

    // transmit the arguments
    this._queueParticle();
    this.currentParticle = {
      p: 'fc_',
      i_args: argsJsonChunk,
    };
    this._queueParticle();
  }

  /** Creates a CE request part, flushing the previous one if needed, and completes it */
  addCodeExecutionToolCall(id: string | null, language: string, code: string) {
    this.endMessagePart();
    this.transmissionQueue.push({
      p: 'code-call',
      id: id ?? serverSideId('aix-tool-call-id'),
      language,
      code,
    });
  }

  /** Creates a CE result part, flushing the previous one if needed, and completes it */
  addCodeExecutionResponse(id: string | null, output: string, error: string | undefined) {
    this.endMessagePart();
    this.transmissionQueue.push({
      p: 'code-response',
      id: id ?? serverSideId('aix-tool-response-id'),
      output,
      error,
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
  setCounters(counts: AixAPI_Particles.ChatGenerateCounts) {
    if (!this.accCounts)
      this.accCounts = {};
    Object.assign(this.accCounts, counts);
    this.freshCounts = true;
  }

}
