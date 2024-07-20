import { serverSideId } from '~/server/api/trpc.nanoid';

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
export class PartTransmitter {

  constructor(private readonly prettyDialect: string) {
  }


  /// Control plane

  terminateParser(reasonId: 'message-stop' | 'dialect-issue') {
    // return yield { op: 'parser-close' };
    console.log('terminateParser', reasonId);
  }

  /**
   * Originally: yield { t: ` ${dma.symbol} **[${prettyDialect} Issue]:** ${dma.issue}` }
   */
  terminatingDialectIssue(issue: string, symbol?: string) {
    // yield { op: 'issue', issue: `Input not allowed: ${blockReason}: ${_explainGeminiSafetyIssues(safetyRatings)}`, symbol: ISSUE_SYMBOL_PROMPT_BLOCKED };
    // return yield { op: 'parser-close' };
    console.log('terminatingIssue', issue, symbol);
    this.terminateParser('dialect-issue');
  }

  flush() {
    console.log('flush');
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

  // Sent right away
  setModelName(modelName: string) {
    console.log('setModelName', modelName);
  }

  // Sent right away and on completion, if there have been updates
  setCounters(counts: {
    chatIn?: number,
    chatOut?: number,
    chatTotal?: number,
    chatOutRate?: number,
    chatTimeInner?: number,
  }) {
    console.log('setTokenCounts', counts);
  }

}
