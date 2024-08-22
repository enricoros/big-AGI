import type { AixWire_Particles } from '~/modules/aix/server/api/aix.wiretypes';


export interface IParticleTransmitter {

  // Parser-initiated Control //

  /** Set the end reason - only use for 'done-dialect' to signal a dialect-close */
  setEnded(reason: Extract<AixWire_Particles.CGEndReason, 'done-dialect' | 'issue-dialect'>): void;

  /** End the current part and flush it */
  setDialectTerminatingIssue(dialectText: string, symbol: string | null): void;


  // Parts data //

  /** Closes the current part, also flushing it out */
  endMessagePart(): void;

  /** Appends text, creating a part if missing [throttled] */
  appendText(textChunk: string): void;

  /**
   * Creates a FC part, flushing the previous one if needed, and starts adding data to it
   * @param id if null [Gemini], a new id will be generated to keep it linked to future tool responses
   * @param functionName required.
   * @param expectedArgsFmt 'incr_str' | 'json_object' - 'incr_str' for incremental string, 'json_object' for JSON object
   * @param args must be undefined, or match the expected Args Format
   */
  startFunctionCallInvocation(id: string | null, functionName: string, expectedArgsFmt: 'incr_str' | 'json_object', args: string | object | null): void;

  /** Appends data to a FC part [throttled] */
  appendFunctionCallInvocationArgs(id: string | null, argsJsonChunk: string): void;

  /** Creates a CE request part, flushing the previous one if needed, and completes it */
  addCodeExecutionInvocation(id: string | null, language: string, code: string, author: 'gemini_auto_inline'): void;

  /** Creates a CE result part, flushing the previous one if needed, and completes it */
  addCodeExecutionResponse(id: string | null, error: boolean | string, result: string, executor: 'gemini_auto_inline', environment: 'upstream'): void;


  // Non-parts data //

  /** Communicates the model name to the client */
  setModelName(modelName: string): void;

  /** Communicates the finish reason to the client */
  setTokenStopReason(reason: AixWire_Particles.GCTokenStopReason): void;

  /** Update the metrics, sent twice (after the first call, and then at the end of the transmission) */
  updateMetrics(update: Partial<AixWire_Particles.CGSelectMetrics>): void;

}
