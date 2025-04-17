import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter } from '../IParticleTransmitter';
import { IssueSymbols } from '../ChatGenerateTransmitter';

import { GeminiWire_API_Generate_Content, GeminiWire_Safety } from '../../wiretypes/gemini.wiretypes';


// configuration
const ENABLE_RECITATIONS_AS_CITATIONS = false;


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
export function createGeminiGenerateContentResponseParser(requestedModelName: string, isStreaming: boolean): ChatGenerateParseFunction {
  const parserCreationTimestamp = Date.now();
  let sentRequestedModelName = false;
  let sentActualModelName = false;
  let timeToFirstEvent: number;
  let skipComputingTotalsOnce = isStreaming;
  let groundingIndexNumber = 0;

  // this can throw, it's caught by the caller
  return function(pt: IParticleTransmitter, eventData: string): void {

    // Time to first event
    if (timeToFirstEvent === undefined)
      timeToFirstEvent = Date.now() - parserCreationTimestamp;

    // Throws on malformed event data
    const generationChunk = GeminiWire_API_Generate_Content.Response_schema.parse(JSON.parse(eventData));

    // -> Model
    if (generationChunk.modelVersion && !sentActualModelName) {
      pt.setModelName(generationChunk.modelVersion);
      sentActualModelName = true;
    }
    if (!sentActualModelName && !sentRequestedModelName) {
      pt.setModelName(requestedModelName);
      sentRequestedModelName = true;
    }

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

      // -> Candidates[0] -> Content
      for (const mPart of (candidate0.content?.parts || [])) {
        switch (true) {

          // <- TextPart
          case 'text' in mPart:
            // [Gemini, 2025-01-23] CoT support
            if (mPart.thought)
              pt.appendReasoningText(mPart.text || '');
            else
              pt.appendText(mPart.text || '');
            break;

          // <- InlineDataPart
          case 'inlineData' in mPart:
            // [Gemini, 2025-03-14] Experimental Image generation: Response
            if (mPart.inlineData.mimeType.startsWith('image/'))
              pt.appendImageInline(mPart.inlineData.mimeType, mPart.inlineData.data, 'Gemini Generated Image', 'Gemini', '');
            else
              pt.setDialectTerminatingIssue(`Unsupported inline data type: ${mPart.inlineData.mimeType}`, null);
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
            // noinspection JSUnusedLocalSymbols
            const _exhaustiveCheck: never = mPart;
            throw new Error(`unexpected content part: ${JSON.stringify(mPart)}`);
        }
      }

      // -> Candidates[0] -> Safety Ratings
      // only parsed when the finish reason is 'SAFETY'

      // -> Candidates[0] -> Citation Metadata
      // this is automated recitation detection by the API, not explicit grounding - very weak signal - as websites appear to be poor quality
      if (ENABLE_RECITATIONS_AS_CITATIONS && candidate0.citationMetadata?.citationSources?.length) {
        for (let { startIndex, endIndex, uri /*, license*/ } of candidate0.citationMetadata.citationSources) {
          // TODO: have a particle/part flag to state the purpose of a citation? (e.g. 'recitation' is weaker than 'grounding')
          pt.appendUrlCitation('', uri || '', undefined, startIndex, endIndex, undefined);
        }
      }

      // -> Candidates[0] -> Grounding Metadata
      if (candidate0.groundingMetadata?.groundingChunks?.length) {
        /**
         * TODO: improve parsing of grounding metadata, including:
         * - annotations and ranges .groundingSupports
         * - sort chunks by their overal confidence in the .groundingSupports?
         * - follow up Google Search queries (.webSearchQueries)
         * - include the 'renderedContent' from .searchEntryPoint
         */
        for (const { web } of candidate0.groundingMetadata.groundingChunks) {
          pt.appendUrlCitation(web.title, web.uri, ++groundingIndexNumber, undefined, undefined, undefined);
        }
      }

      // -> Candidates[0] -> Token Stop Reason
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

          case 'IMAGE_SAFETY':
            pt.setTokenStopReason('filter-content');
            return pt.setDialectTerminatingIssue(`Generation stopped due the generated images contain safety violations`, null);

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
      if (generationChunk.usageMetadata.thoughtsTokenCount)
        metricsUpdate.TOutR = generationChunk.usageMetadata.thoughtsTokenCount;

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
    .join(', ') || 'Undocumented Gemini Safety Category.';
}

function _geminiHarmProbabilitySortFunction(a: { probability: string }, b: { probability: string }) {
  const order = ['NEGLIGIBLE', 'LOW', 'MEDIUM', 'HIGH'];
  return order.indexOf(b.probability) - order.indexOf(a.probability);
}
