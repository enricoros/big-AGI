import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { AixTools_ToolDefinition, AixTools_ToolsPolicy } from '~/modules/aix/server/api/aix.wiretypes';


/**
 * Outcome classification for a single probe run.
 * - The goal is to converge on 'function_call_ok' as the ground-truth for real function-calling support.
 * - 'no_tool_text_only' for policy 'auto' can be informational (model chose text); for policy 'any' it is a failure.
 */
export type ProbeOutcome =
  | 'function_call_ok'            // tool_invocation(function_call) with the expected name (roundtrip: turn 2 also used the tool result)
  | 'function_call_wrong_name'    // tool_invocation(function_call) with a different name
  | 'code_execution'              // emitted a code_execution invocation instead of a function_call
  | 'no_tool_text_only'           // only text output, no tool invocation
  | 'empty'                       // model returned no content fragments
  | 'error'                       // AIX produced an error fragment, or the request failed
  | 'aborted'                     // user stopped or per-probe timeout fired
  | 'not_configured'              // pre-LL error (e.g. service/access missing, model not found)
  | 'roundtrip_loop'              // roundtrip turn 2 re-emitted a tool call instead of answering
  | 'roundtrip_no_signal'         // roundtrip turn 2 returned text that didn't reference the injected tool result
  | 'skipped';                    // not run


export interface ProbeResult {
  scenarioId: string;             // ProbeScenario.id
  llmId: DLLMId;
  ts: number;                     // epoch ms of completion
  durationMs: number;             // wall-clock duration
  outcome: ProbeOutcome;
  emittedSequence: string[];      // ordered part labels as emitted (e.g. ['think','fn','text'])
  functionName?: string;          // extracted from the first tool_invocation, if any
  argsSample?: string;            // first 200 chars of args JSON
  textSample?: string;            // first 200 chars of concatenated text
  errorMessage?: string;          // human-readable error message, if any
  costStatus?: string;            // metrics.$code (no-tokens | no-pricing | free | partial-price | partial-msg)
  costUsd?: number;               // metrics.$c / 100 (converted from cents to dollars)
  tokensIn?: number;              // metrics.TIn (new input tokens, excluding cache)
  tokensOut?: number;             // metrics.TOut
  tokensReasoning?: number;       // metrics.TOutR
}


/**
 * Definition of a probe scenario - a small, deterministic test we run against a model.
 */
export interface ProbeScenario {
  id: string;                     // stable id used as persistence key and in CSVs
  label: string;                  // human-readable, shown in the UI
  description: string;            // short explanation
  systemMessage: string;          // system instruction
  userMessage: string;            // single-turn user message
  tools: AixTools_ToolDefinition[];
  toolsPolicy: AixTools_ToolsPolicy;
  expectedFunctionName: string;   // for outcome classification
  /**
   * If set, after turn 1's function call, the runner injects a canned tool_response and re-dispatches.
   * Pass requires turn 2 to emit text containing at least one signalToken (case-insensitive).
   */
  roundtrip?: {
    cannedResult: string;         // JSON-stringified object (single-object only; not array/string)
    signalTokens: string[];       // at least one must appear in turn 2 text (lowercase-compared)
  };
}
