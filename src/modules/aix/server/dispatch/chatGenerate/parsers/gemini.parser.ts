import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter } from '../IParticleTransmitter';
import { IssueSymbols } from '../ChatGenerateTransmitter';

import { GeminiWire_API_Generate_Content, GeminiWire_Safety } from '../../wiretypes/gemini.wiretypes';

/**
 * Gemini Completions -  Messages Architecture
 *
 * Will send a single candidate (the API does not support more than 1), which will contain the content parts.
 * There is just a single Part per Candidate, unless the chunk contains parallel function calls, in which case they're in parts.
 *
 * Beginning and End are implicit and follow the natural switching of parts in a progressive order; Gemini may for instance
 * send incremental text parts, then call functions, then send more text parts, which we'll translate to multi parts.
 *
 * Parts assumptions:
 *  - 'text' parts are incremental, and meant to be concatenated
 *  - 'functionCall' are whole
 *  - 'executableCode' are whole
 *  - 'codeExecutionResult' are whole *
 *
 *  Note that non-streaming calls will contain a complete sequence of complete parts.
 */
export function createGeminiGenerateContentResponseParser(modelId: string, isStreaming: boolean): ChatGenerateParseFunction {
  const parserCreationTimestamp = Date.now();
  const modelName = modelId.replace('models/', '');
  let hasBegun = false;
  let timeToFirstEvent: number;
  let skipComputingTotalsOnce = isStreaming;

  // this can throw, it's caught by the caller
  return function(pt: IParticleTransmitter, eventData: string): void {

    // Time to first event
    if (timeToFirstEvent === undefined)
      timeToFirstEvent = Date.now() - parserCreationTimestamp;

    // -> Model
    if (!hasBegun) {
      hasBegun = true;
      pt.setModelName(modelName);
    }

    // Throws on malformed event data
    const generationChunk = GeminiWire_API_Generate_Content.Response_schema.parse(JSON.parse(eventData));

    // -> Prompt Safety Blocking
    if (generationChunk.promptFeedback?.blockReason) {
      const { blockReason, safetyRatings } = generationChunk.promptFeedback;
      return pt.setDialectTerminatingIssue(`Input not allowed: ${blockReason}: ${_explainGeminiSafetyIssues(safetyRatings)}`, IssueSymbols.PromptBlocked);
    }

    // candidates may be an optional field (started happening on 2024-09-27)
    if (generationChunk.candidates) {

      // expect: single completion
      if (generationChunk.candidates.length !== 1)
        throw new Error(`expected 1 completion, got ${generationChunk.candidates?.length}`);
      const candidate0 = generationChunk.candidates[0];
      if (candidate0.index !== undefined && candidate0.index !== 0)
        throw new Error(`expected completion index 0, got ${candidate0.index}`);

      // see the message architecture
      for (const mPart of (candidate0.content?.parts || [])) {
        switch (true) {

          // <- TextPart
          case 'text' in mPart:
            pt.appendText(mPart.text || '');
            break;

          // <- FunctionCallPart
          case 'functionCall' in mPart:
            pt.startFunctionCallInvocation(null, mPart.functionCall.name, 'json_object', mPart.functionCall.args ?? null);
            pt.endMessagePart();
            break;

          // <- ExecutableCodePart
          case 'executableCode' in mPart:
            pt.addCodeExecutionInvocation(null, mPart.executableCode.language || '', mPart.executableCode.code || '', 'gemini_auto_inline');
            break;

          // <- CodeExecutionResultPart
          case 'codeExecutionResult' in mPart:
            switch (mPart.codeExecutionResult.outcome) {
              case 'OUTCOME_OK':
                pt.addCodeExecutionResponse(null, false, mPart.codeExecutionResult.output || '', 'gemini_auto_inline', 'upstream');
                break;
              case 'OUTCOME_FAILED':
                pt.addCodeExecutionResponse(null, true, mPart.codeExecutionResult.output || '', 'gemini_auto_inline', 'upstream');
                break;
              case 'OUTCOME_DEADLINE_EXCEEDED':
                const deadlineError = 'Code execution deadline exceeded' + (mPart.codeExecutionResult.output ? `: ${mPart.codeExecutionResult.output}` : '');
                pt.addCodeExecutionResponse(null, deadlineError, '', 'gemini_auto_inline', 'upstream');
                break;
              default:
                throw new Error(`unexpected code execution outcome: ${mPart.codeExecutionResult.outcome}`);
            }
            break;

          default:
            throw new Error(`unexpected content part: ${JSON.stringify(mPart)}`);
        }
      }

      // -> Token Stop Reason
      if (candidate0.finishReason) {
        switch (candidate0.finishReason) {
          case 'STOP':
            // this is expected for every fragment up to the end, when it may switch to one of the reasons below in the last packet
            // we cannot assume this signals a good ending, however it will be `pt` to set it to 'ok' if not set to an issue by the end
            break;

          case 'MAX_TOKENS':
            pt.setTokenStopReason('out-of-tokens');
            // NOTE: we call setEnded instread of setDialectTerminatingIssue, because we don't want an extra message appended,
            // as we know that 'out-of-tokens' will likely append a brick wall (simple/universal enough).
            return pt.setEnded('issue-dialect');

          case 'SAFETY':
            pt.setTokenStopReason('filter-content');
            return pt.setDialectTerminatingIssue(`Generation stopped due to SAFETY: ${_explainGeminiSafetyIssues(candidate0.safetyRatings)}`, null);

          case 'RECITATION':
            pt.setTokenStopReason('filter-recitation');
            return pt.setDialectTerminatingIssue(`Generation stopped due to RECITATION`, IssueSymbols.Recitation);

          case 'LANGUAGE':
            pt.setTokenStopReason('filter-content');
            return pt.setDialectTerminatingIssue(`Generation stopped due to LANGUAGE`, IssueSymbols.Language);

          case 'OTHER':
            pt.setTokenStopReason('filter-content');
            return pt.setDialectTerminatingIssue(`Generation stopped due to 'OTHER' (unknown reason)`, null);

          case 'BLOCKLIST':
            pt.setTokenStopReason('filter-content');
            return pt.setDialectTerminatingIssue(`Generation stopped due the content containing forbidden terms`, null);

          case 'PROHIBITED_CONTENT':
            pt.setTokenStopReason('filter-content');
            return pt.setDialectTerminatingIssue(`Generation stopped due to potentially containing prohibited content`, null);

          case 'SPII':
            pt.setTokenStopReason('filter-content');
            return pt.setDialectTerminatingIssue(`Generation stopped due to potentially containing Sensitive Personally Identifiable Information (SPII)`, null);

          case 'MALFORMED_FUNCTION_CALL':
            pt.setTokenStopReason('cg-issue');
            return pt.setDialectTerminatingIssue(`Generation stopped due to the function call generated by the model being invalid`, null);

          default:
            throw new Error(`unexpected empty generation (finish reason: ${candidate0?.finishReason})`);
        }
      }
    } /* end of .candidates */

    // -> Stats
    if (generationChunk.usageMetadata) {
      const metricsUpdate: AixWire_Particles.CGSelectMetrics = {
        TIn: generationChunk.usageMetadata.promptTokenCount,
        TOut: generationChunk.usageMetadata.candidatesTokenCount,
      };
      if (isStreaming && timeToFirstEvent !== undefined)
        metricsUpdate.dtStart = timeToFirstEvent;

      // the first end-1 packet will be skipped (when streaming)
      if (!skipComputingTotalsOnce) {
        metricsUpdate.dtAll = Date.now() - parserCreationTimestamp;
        if (!isStreaming && metricsUpdate.dtAll > timeToFirstEvent)
          metricsUpdate.dtInner = metricsUpdate.dtAll - timeToFirstEvent;
        if (isStreaming && metricsUpdate.TOut)
          metricsUpdate.vTOutInner = Math.round(100 * 1000 /*ms/s*/ * metricsUpdate.TOut / (metricsUpdate.dtInner || metricsUpdate.dtAll)) / 100;
      }
      // the second (end) packet will be sent
      skipComputingTotalsOnce = false;

      pt.updateMetrics(metricsUpdate);
    }

  };
}


function _explainGeminiSafetyIssues(safetyRatings?: GeminiWire_Safety.SafetyRating[]): string {
  if (!safetyRatings || !safetyRatings.length)
    return 'no safety ratings provided';
  safetyRatings = (safetyRatings || []).sort(_geminiHarmProbabilitySortFunction);
  // only for non-neglegible probabilities
  return safetyRatings
    .filter(rating => rating.probability !== 'NEGLIGIBLE')
    .map(rating => `${rating.category/*.replace('HARM_CATEGORY_', '')*/} (${rating.probability?.toLowerCase()})`)
    .join(', ');
}

function _geminiHarmProbabilitySortFunction(a: { probability: string }, b: { probability: string }) {
  const order = ['NEGLIGIBLE', 'LOW', 'MEDIUM', 'HIGH'];
  return order.indexOf(b.probability) - order.indexOf(a.probability);
}
