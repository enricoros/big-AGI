import { SERVER_DEBUG_WIRE } from '~/server/wire';
import { serverSideId } from '~/server/api/trpc.nanoid';

import type { AixWire_API_Particles as Particles } from '../../api/aix.wiretypes';


// configuration
export const IssueSymbols = {
  Generic: '❌',
  PromptBlocked: '🚫',
  Recitation: '🦜',
  GenMaxTokens: '🧱',
};


// TODO: fully implement this class
// Needs to:
// - serialize the operations into a buffer that can be then yielded to the client (ideally via some Generator pattern?) which will allow PartReassembler to reassemble into AixWire_Parts objects
// - verify the consistency of the operations via some basic state machinery
//   - throw on state issues
// - implement the actual operations
export class ChatGenerateTransmitter {

  // Queued operations
  private operations: Particles.ChatGenerateOp[] = [];
  private currentPart: Particles.ChatGenerateOp | null = null;

  // Counters
  private accCounts: Particles.ChatGenerateCounts | undefined = undefined;
  private sentCounts: boolean = false;
  private freshCounts: boolean = false;

  // Termination
  private terminationReason: Particles.CGEndReason | null /* if reset (not impl.) */ | undefined = undefined;


  constructor(private readonly prettyDialect: string, throttleTimeMs: number | undefined) {
  }


  get isEnded() {
    return !!this.terminationReason;
  }

  setEnded(reason: Particles.CGEndReason) {
    if (SERVER_DEBUG_WIRE || true)
      console.log('|terminate|', reason, this.isEnded ? `(WARNING: already terminated ${this.terminationReason})` : '');
    this.terminationReason = reason;
  }


  setEndedIssue(endReason: Particles.CGEndReason, issueId: Particles.CGIssueId, issueText: string, forceConsoleMessage?: boolean) {
    // These issues are particularly important to debug
    if (SERVER_DEBUG_WIRE || forceConsoleMessage || true)
      console.error(`Aix.${this.prettyDialect} (${issueId}): ${issueText}`);
    // queue the issue
    this.endCurrentPart();
    this.operations.push({ cg: 'issue', issueId, issueText });
    // set the end
    this.setEnded(endReason);
  }

  endCurrentPart() {
    if (this.currentPart) {
      this.operations.push(this.currentPart);
      this.currentPart = null;
    }
  }


  * flushTerminatingRpcIssue(issueId: Particles.CGIssueId, issueText: string, forceConsoleMessage?: boolean): Generator<Particles.ChatGenerateOp> {
    this.setEndedIssue('issue-rpc', issueId, issueText, forceConsoleMessage);
    yield* this.flushParticles();
  }

  * flushParticles(): Generator<Particles.ChatGenerateOp> {
    this.endCurrentPart();
    this.sentCounts = false; // enable sending counters again
    return yield* this.emitParticles();
  }

  * emitParticles(): Generator<Particles.ChatGenerateOp> {
    // Counters
    if (!this.sentCounts && this.freshCounts && this.accCounts) {
      this.sentCounts = true;
      this.freshCounts = false;
      yield { cg: 'update-counts', counts: this.accCounts };
    }

    // Queued operations
    for (const op of this.operations)
      yield op;
    this.operations = [];

    // Termination
    if (this.terminationReason) {
      yield { cg: 'end', reason: this.terminationReason };
      // Keep this in a terminated state, so that every subsequent call will yield errors
      // this.terminationReason = null;
    }
  }


  /// Control plane


  /**
   * Originally: yield { t: ` ${dma.symbol} **[${prettyDialect} Issue]:** ${dma.issue}` }
   */
  endingDialectIssue(dialectText: string, symbol?: string) {
    this.setEndedIssue('issue-dialect', 'dialect-issue', ` ${symbol} **[${this.prettyDialect} Issue]:** ${dialectText}`);
  }


  /// Parts data

  // Appends text, creating a part if missing [throttled]
  appendText(text: string) {
    console.log('appendText', text);
    // yield { op: 'text', text: ` ${TEXT_SYMBOL_MAX_TOKENS}` /* Interrupted: MAX_TOKENS reached */ };
  }

  /**
   * Creates a FC part, flushing the previous one if needed, and starts adding data to it
   * @param id if null [Gemini], a new id will be generated to keep it linked to future tool responses
   * @param functionName required.
   * @param expectedArgsFmt 'incr_str' | 'json_object' - 'incr_str' for incremental string, 'json_object' for JSON object
   * @param args must be undefined, or match the expected Args Format
   */
  startFunctionToolCall(id: string | null, functionName: string, expectedArgsFmt: 'incr_str' | 'json_object', args?: string | object | null) {
    // NOTE the object(!) returned at least by anthropic and gemini when complete
    if (!id) id = serverSideId('aix-tool-call-id');
    console.log('FC', id, functionName, args);
  }

  // Appends data to a FC part [throttled]
  appendFunctionToolCallArgsIStr(id: string | null, argsJson: string) {
    console.log('FC+', id, argsJson);
  }

  // Creates a CE request part, flushing the previous one if needed, and completes it
  addCodeExecutionToolCall(id: string | null, language: string, code: string) {
    if (!id) id = serverSideId('aix-tool-call-id');
    console.log('CE_Req', id, language, code);
    this.endPart();
  }

  // Creates a CE result part, flushing the previous one if needed, and completes it
  addCodeExecutionResponse(id: string | null, output: string, error: string | undefined) {
    if (!id) id = serverSideId('aix-tool-response-id');
    console.log('CE_Resp', id, output, error);
    this.endPart();
  }

  // Closes the current part, flushing it out
  endPart() {
    console.log('endPart');
  }


  /// More data

  // Immediate
  setModelName(modelName: string) {
    this.operations.push({ cg: 'set-model', name: modelName });
  }

  // Will send it as soon as available, and at the end, if updated
  setCounters(counts: Particles.ChatGenerateCounts) {
    if (!this.accCounts)
      this.accCounts = {};
    Object.assign(this.accCounts, counts);
    this.freshCounts = true;
  }


}
