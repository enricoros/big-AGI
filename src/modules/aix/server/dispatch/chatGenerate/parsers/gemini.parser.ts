import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter } from './IParticleTransmitter';
import { IssueSymbols } from '../ChatGenerateTransmitter';

import { GeminiWire_API_Generate_Content, GeminiWire_Safety } from '../../wiretypes/gemini.wiretypes';

import { geminiConvertPCM2WAV } from './gemini.audioutils';


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
  return function(pt: IParticleTransmitter, rawEventData: string): void {

    // Time to first event
    if (timeToFirstEvent === undefined)
      timeToFirstEvent = Date.now() - parserCreationTimestamp;

    // Throws on malformed event data
    const eventData = JSON.parse(rawEventData);

    // [Gemini, 2025-10-22] Early detection of proxy errors - being sent as an assistant message
    if (eventData?.candidates?.length === 1) {
      const finishReason = eventData.candidates[0]?.finishReason;
      if (typeof finishReason === 'string')

        // FIXME: potential point for throwing RequestRetryError (using 'srv-warn' for now)
        //        in case of transient errors (502, 503, proxy queue, etc.) - not for good codes.

        switch (true) {
          case finishReason.includes('503 Service Unavailable'):
            // pt.setTokenStopReason('cg-issue');
            // TODO: tell the client about a classification code?
            //       E.g. send a TRPCFetcherError-compatible `error` downstream, or also send
            //       the equivalent of .aixFCategory/.aixFHttpStatus/.aixFNetError (see trpc.server.ts)
            return pt.setDialectTerminatingIssue(`Gemini Internal Proxy Error detected: ${finishReason}`, null, 'srv-warn');

          case finishReason.startsWith('Proxy queue error'):
            // pt.setTokenStopReason('cg-issue');
            return pt.setDialectTerminatingIssue(`Gemini Internal Proxy Queue Error detected: ${finishReason}`, null, 'srv-warn');

          case finishReason.startsWith('Proxy error'):
            // pt.setTokenStopReason('cg-issue');
            return pt.setDialectTerminatingIssue(`Gemini Internal Proxy Error detected: ${finishReason}`, null, 'srv-warn');

          default:
            // NOTE: the 'GOOD' default values shall be GeminiWire_API_Generate_Content.FinishReason_enum, e.g. STOP, MAX_TOKENS, SAFETY, .. TOO_MANY_TOOL_CALLS, etc.
            break;
        }
    }

    // Validate schema and parse
    const generationChunk = GeminiWire_API_Generate_Content.Response_schema.parse(eventData);

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
      return pt.setDialectTerminatingIssue(`Input not allowed: ${blockReason}: ${_explainGeminiSafetyIssues(safetyRatings)}`, IssueSymbols.PromptBlocked, false);
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
            // [Gemini 3, 2025-11-18] Log thought signatures for debugging
            // https://ai.google.dev/gemini-api/docs/gemini-3?thinking=high#thought_signatures
            if ('thoughtSignature' in mPart && mPart.thoughtSignature?.length) {
              console.log(`[Gemini] Text part with thought signature (length: ${mPart.thoughtSignature.length})`);
              // TODO: Store signature for echo-back in next request
            }
            // [Gemini, 2025-01-23] CoT support
            if (mPart.thought)
              pt.appendReasoningText(mPart.text || '');
            else
              pt.appendText(mPart.text || '');
            break;

          // <- InlineDataPart
          case 'inlineData' in mPart:
            // [Gemini, 2025-03-14] Experimental Image generation: Response
            if (mPart.inlineData.mimeType.startsWith('image/')) {
              pt.appendImageInline(
                mPart.inlineData.mimeType,
                mPart.inlineData.data,
                'Gemini Generated Image',
                'Gemini',
                '',
              );
            } else if (mPart.inlineData.mimeType.startsWith('audio/')) {
              try {
                // Convert the API response from PCM to WAV: {
                //   "mimeType": "audio/L16;codec=pcm;rate=24000",
                //   "data": "7P/z/wQACg...==" (57,024 bytes)
                // }
                const convertedAudio = geminiConvertPCM2WAV(mPart.inlineData.mimeType, mPart.inlineData.data);
                pt.appendAudioInline(
                  convertedAudio.mimeType,
                  convertedAudio.base64Data,
                  'Gemini Generated Audio',
                  'Gemini',
                  convertedAudio.durationMs,
                );
              } catch (error) {
                console.warn('[Gemini] Failed to convert audio:', error);
                pt.setDialectTerminatingIssue(`Failed to process audio: ${error}`, null, 'srv-warn');
              }
            } else
              pt.setDialectTerminatingIssue(`Unsupported inline data type: ${mPart.inlineData.mimeType}`, null, 'srv-warn');
            break;

          // <- FunctionCallPart
          case 'functionCall' in mPart:
            let { id: fcId, name: fcName, args: fcArgs } = mPart.functionCall;
            // [Gemini 3, 2025-11-18] Log thought signatures for debugging
            if ('thoughtSignature' in mPart && mPart.thoughtSignature?.length) {
              console.log(`[Gemini] Function call with thought signature: ${fcName} (signature length: ${mPart.thoughtSignature.length})`);
              // TODO: Store signature for echo-back in next request (pending tool execution graph rebuild)
            }
            // Validate the function call arguments - we expect a JSON object, not just any JSON value
            if (!fcArgs || typeof fcArgs !== 'object')
              console.warn(`[Gemini] Invalid function call arguments: ${JSON.stringify(fcArgs)} for ${fcName}`);
            else
              pt.startFunctionCallInvocation(fcId ?? null, fcName, 'json_object', fcArgs);
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
          pt.appendUrlCitation('', uri || '', undefined, startIndex, endIndex, undefined, undefined);
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
        for (const { web } of candidate0.groundingMetadata.groundingChunks)
          pt.appendUrlCitation(web.title, web.uri, ++groundingIndexNumber, undefined, undefined, undefined, undefined);
      }

      // -> Candidates[0] -> URL Context Metadata
      if (candidate0.urlContextMetadata?.urlMetadata?.length) {
        for (const urlMeta of candidate0.urlContextMetadata.urlMetadata) {
          // Only add URLs that were successfully retrieved
          if (urlMeta.urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_SUCCESS')
            pt.appendUrlCitation('', urlMeta.retrievedUrl, ++groundingIndexNumber, undefined, undefined, undefined, undefined);
          else if (urlMeta.urlRetrievalStatus !== 'URL_RETRIEVAL_STATUS_UNSPECIFIED')
            console.warn(`[Gemini] URL retrieval ${urlMeta.urlRetrievalStatus}: ${urlMeta.retrievedUrl}`); // log for debugging
        }
      }

      // -> Candidates[0] -> Token Stop Reason
      if (candidate0.finishReason) {
        // Helper to append finishMessage if available
        // NOTE: unused for now, hasn't been tested
        // const withFinishMessage = (baseMessage: string) =>
        //   candidate0.finishMessage ? `${baseMessage}: ${candidate0.finishMessage}` : baseMessage;

        switch (candidate0.finishReason) {
          case 'STOP':
            // this is expected for every fragment up to the end, when it may switch to one of the reasons below in the last packet
            // we cannot assume this signals a good ending, however it will be `pt` to set it to 'ok' if not set to an issue by the end
            break;

          case 'MAX_TOKENS':
            pt.setTokenStopReason('out-of-tokens');
            // NOTE: we call setEnded instead of setDialectTerminatingIssue, because we don't want an extra message appended,
            // as we know that 'out-of-tokens' will likely append a brick wall (simple/universal enough).
            return pt.setEnded('issue-dialect');

          // will set both TokenStop and TerminatingIssue
          case 'SAFETY':
          case 'RECITATION':
          case 'LANGUAGE':
          case 'OTHER':
          case 'BLOCKLIST': // Token generation stopped because the content contains forbidden terms
          case 'PROHIBITED_CONTENT': // Token generation stopped for potentially containing prohibited content
          case 'SPII': // Token generation stopped because the content potentially contains Sensitive Personally Identifiable Information
          case 'MALFORMED_FUNCTION_CALL': // The function call generated by the model is invalid
          case 'IMAGE_SAFETY': // Token generation stopped because generated images contain safety violations
          case 'IMAGE_PROHIBITED_CONTENT': // Image generation stopped because generated images have prohibited content
          case 'IMAGE_RECITATION': // Image generation stopped due to recitation
          case 'IMAGE_OTHER': // Image generation stopped because of other miscellaneous issue
          case 'NO_IMAGE': // The model was expected to generate an image, but none was generated
          case 'UNEXPECTED_TOOL_CALL': // Model generated a tool call but no tools were enabled in the request
          case 'TOO_MANY_TOOL_CALLS': // Model called too many tools consecutively, execution limit exceeded
          case 'FINISH_REASON_UNSPECIFIED':
            const reasonMap: Record<typeof candidate0.finishReason, [AixWire_Particles.GCTokenStopReason, string, string | null]> = {
              'SAFETY': ['filter-content', `Generation stopped due to SAFETY: ${_explainGeminiSafetyIssues(candidate0.safetyRatings)}`, null],
              'RECITATION': ['filter-recitation', 'Generation stopped due to RECITATION', IssueSymbols.Recitation],
              'LANGUAGE': ['filter-refusal', 'Generation stopped due to unsupported LANGUAGE', IssueSymbols.Language],
              'OTHER': ['cg-issue', `Generation stopped due to 'OTHER' (unknown reason)`, null],
              'BLOCKLIST': ['filter-content', 'Generation stopped: content contains forbidden terms', null],
              'PROHIBITED_CONTENT': ['filter-content', 'Generation stopped: potentially prohibited content', null],
              'SPII': ['filter-content', 'Generation stopped: potentially contains Sensitive PII (SPII)', null],
              'MALFORMED_FUNCTION_CALL': ['cg-issue', 'Generation stopped: invalid function call generated by model', null],
              'IMAGE_SAFETY': ['filter-content', 'Image generation stopped: safety violations', null],
              'IMAGE_PROHIBITED_CONTENT': ['filter-content', 'Image generation stopped: prohibited content', null],
              'IMAGE_RECITATION': ['filter-recitation', 'Image generation stopped: recitation detected', IssueSymbols.Recitation],
              'IMAGE_OTHER': ['cg-issue', 'Image generation stopped: miscellaneous issue', null],
              'NO_IMAGE': ['cg-issue', 'Image generation failed: no image generated', null],
              'UNEXPECTED_TOOL_CALL': ['cg-issue', 'Generation stopped: tool call made but no tools enabled', null],
              'TOO_MANY_TOOL_CALLS': ['cg-issue', 'Generation stopped: too many consecutive tool calls', null],
              'FINISH_REASON_UNSPECIFIED': ['cg-issue', 'Generation stopped and no reason was given', null],
            } as const;
            const reason = reasonMap[candidate0.finishReason];
            pt.setTokenStopReason(reason[0]);
            return pt.setDialectTerminatingIssue(reason[1], reason[2], false);

          default:
            // Exhaustiveness check - if we get here, Gemini added a new finishReason
            const _exhaustiveCheck: never = candidate0.finishReason as Exclude<typeof candidate0.finishReason, string>;
            pt.setTokenStopReason('cg-issue');
            return pt.setDialectTerminatingIssue(`unexpected Gemini finish reason: ${candidate0?.finishReason})`, null, 'srv-warn');
        }
      }
    } /* end of .candidates */

    // -> Stats
    if (generationChunk.usageMetadata) {
      const metricsUpdate: AixWire_Particles.CGSelectMetrics = {
        TIn: generationChunk.usageMetadata.promptTokenCount,
        TOut: generationChunk.usageMetadata.candidatesTokenCount,
      };

      // Add reasoning tokens if available
      if (generationChunk.usageMetadata.thoughtsTokenCount) {
        metricsUpdate.TOutR = generationChunk.usageMetadata.thoughtsTokenCount;
        metricsUpdate.TOut = (metricsUpdate.TOut ?? 0) + metricsUpdate.TOutR; // in gemini candidatesTokenCount does not include reasoning tokens
      }

      // Subtract auto-cached (read) input tokens
      if (generationChunk.usageMetadata.cachedContentTokenCount) {
        metricsUpdate.TCacheRead = generationChunk.usageMetadata.cachedContentTokenCount;
        if ((metricsUpdate.TIn ?? 0) > metricsUpdate.TCacheRead)
          metricsUpdate.TIn = (metricsUpdate.TIn ?? 0) - metricsUpdate.TCacheRead;
      }

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
