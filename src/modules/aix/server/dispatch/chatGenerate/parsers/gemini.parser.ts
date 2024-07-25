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
export function createGeminiGenerateContentResponseParser(modelId: string): ChatGenerateParseFunction {
  const modelName = modelId.replace('models/', '');
  let hasBegun = false;

  // this can throw, it's caught by the caller
  return function(pt: IParticleTransmitter, eventData: string): void {

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

    // expect: single completion
    if (generationChunk.candidates?.length !== 1)
      throw new Error(`expected 1 completion, got ${generationChunk.candidates?.length}`);
    const candidate0 = generationChunk.candidates[0];
    if (candidate0.index !== 0)
      throw new Error(`expected completion index 0, got ${candidate0.index}`);

    // handle missing content
    if (!candidate0.content) {
      switch (candidate0.finishReason) {

        case 'MAX_TOKENS':
          // NOTE: this will show up in the chat as a message as a brick wall
          // and without the " [Gemini Issue]: Interrupted.." prefix, as it's written in the history
          // This can be changed in the future?
          pt.appendText(` ${IssueSymbols.GenMaxTokens}` /* Interrupted: MAX_TOKENS reached */);
          return pt.setEnded('issue-dialect');

        case 'RECITATION':
          return pt.setDialectTerminatingIssue(`Generation stopped due to RECITATION`, IssueSymbols.Recitation);

        case 'SAFETY':
          return pt.setDialectTerminatingIssue(`Generation stopped due to SAFETY: ${_explainGeminiSafetyIssues(candidate0.safetyRatings)}`, null);

        default:
          throw new Error(`server response missing content (finishReason: ${candidate0?.finishReason})`);

      }
    }

    // see the message architecture
    for (const mPart of candidate0.content.parts) {
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

    // -> Stats
    if (generationChunk.usageMetadata)
      pt.setCounters({
        chatIn: generationChunk.usageMetadata.promptTokenCount,
        chatOut: generationChunk.usageMetadata.candidatesTokenCount,
      });

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
