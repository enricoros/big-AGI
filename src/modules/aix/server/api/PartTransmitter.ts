import { serverSideId } from '~/server/api/trpc.nanoid';

// configuration
export const IssueSymbols = {
  Generic: '❌',
  PromptBlocked: '🚫',
  Recitation: '🦜',
  GenMaxTokens: '🧱',
};


// export type ChatGenerateMessageAction = {
//   op: 'text',
//   text: string;
// } | {
//   op: 'issue';
//   issue: string;
//   symbol: string;
// } | {
//   op: 'parser-close';
// } | {
//   op: 'set';
//   value: {
//     model?: string;
//     stats?: {
//       chatInTokens?: number; // -1: unknown
//       chatOutTokens: number;
//       chatOutRate?: number;
//       timeInner?: number;
//       timeOuter?: number;
//     }
//   };
// };
//
// export type ChatGenerateParseFunction = (eventData: string, eventName?: string) => Generator<ChatGenerateMessageAction>;


export class PartTransmitter {

  constructor(private readonly prettyDialect: string) {
  }


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


  setModelName(modelName: string) {
    console.log('setModelName', modelName);
  }

  appendText(text: string) {
    console.log('appendText', text);
    // yield { op: 'text', text: ` ${TEXT_SYMBOL_MAX_TOKENS}` /* Interrupted: MAX_TOKENS reached */ };
  }


  startFunctionToolCall(id: string | null, functionName: string, expectedArgsFmt: 'incr_str' | 'json_object', args?: string | object | null) {
    // NOTE the object(!) returned at least by anthropic and gemini when complete
    if (!id) id = serverSideId('aix-tool-call-id');
    console.log('FC', id, functionName, args);
  }

  appendFunctionToolCallArgsIStr(id: string | null, argsJson: string) {
    console.log('FC+', id, argsJson);
  }


  addCodeExecutionToolCall(id: string | null, language: string, code: string) {
    if (!id) id = serverSideId('aix-tool-call-id');
    console.log('CE_Req', id, language, code);
    this.endPart();
  }

  addCodeExecutionResponse(id: string | null, output: string, error: string | undefined) {
    if (!id) id = serverSideId('aix-tool-response-id');
    console.log('CE_Resp', id, output, error);
    this.endPart();
  }

  endPart() {
    console.log('endPart');
  }

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