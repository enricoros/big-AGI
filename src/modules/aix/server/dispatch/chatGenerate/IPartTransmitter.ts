import type { AixWire_Particles } from '~/modules/aix/server/api/aix.wiretypes';


export interface IPartTransmitter {

  // Parser-initiated Control //

  /** Set the end reason - only use for 'done-dialect' to signal a dialect-close */
  setEnded(reason: Extract<AixWire_Particles.CGEndReason, 'done-dialect' | 'issue-dialect'>): void;

  /** End the current part and flush it */
  setDialectTerminatingIssue(dialectText: string, symbol?: string): void;


  // Parts data //

  /** Closes the current part, also flushing it out */
  endMessagePart(): void;

  /** Appends text, creating a part if missing [throttled] */
  appendText(text: string): void;

  /**
   * Creates a FC part, flushing the previous one if needed, and starts adding data to it
   * @param id if null [Gemini], a new id will be generated to keep it linked to future tool responses
   * @param functionName required.
   * @param expectedArgsFmt 'incr_str' | 'json_object' - 'incr_str' for incremental string, 'json_object' for JSON object
   * @param args must be undefined, or match the expected Args Format
   */
  startFunctionToolCall(id: string | null, functionName: string, expectedArgsFmt: 'incr_str' | 'json_object', args?: string | object | null): void;

  /** Appends data to a FC part [throttled] */
  appendFunctionToolCallArgsIStr(id: string | null, argsJsonChunk: string): void;

  /** Creates a CE request part, flushing the previous one if needed, and completes it */
  addCodeExecutionToolCall(id: string | null, language: string, code: string): void;

  /** Creates a CE result part, flushing the previous one if needed, and completes it */
  addCodeExecutionResponse(id: string | null, output: string, error: string | undefined): void;


  // Non-parts data //

  /** Communicates the model name to the client */
  setModelName(modelName: string): void;

  /** Update the counters, sent twice (after the first call, and then at the end of the transmission) */
  setCounters(counts: AixWire_Particles.ChatGenerateCounts): void;

}
