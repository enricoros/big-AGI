import { Release } from '~/common/app.release';

import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter, ParticleDialectIssue } from './IParticleTransmitter';
import { aixResilientUnknownValue } from '../../../api/aix.resilience';
import { aixIssueCodeShaped } from '../../../../shared/aix.issues';

import type { GeminiWire_ContentParts } from '../../wiretypes/gemini.wiretypes';
import { GeminiWire_API_Generate_Content, GeminiWire_Safety } from '../../wiretypes/gemini.wiretypes';

import { geminiConvertPCM2WAV } from './gemini.audioutils';


// configuration
const COLLAPSE_EMPTY_TEXT_PARTS = true;
const ENABLE_RECITATIONS_AS_CITATIONS = false;
const DEV_DEBUG_MISSING_IDS = Release.IsNodeDevBuild; // not in staging to reduce noise


/**
 * Gemini Completions -  Messages Architecture
 *
 * Sends a single candidate (candidateCount is 1), which contains the content parts - except on TOO_MANY_TOOL_CALLS with
 * hosted tools, where the aborted step's toolResponse parts arrive as extra candidates (see the candidates block, #1286).
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
  let collapsedTextPartForReasoning = false;
  let skipComputingTotalsOnce = isStreaming;
  const groundingRefNumbers = new Map<string, number>(); // citation number per URI, first appearance
  let nCodeExec = 0;
  let nSearchQueries = 0, nFetchUrls = 0; // [Gemini 3+] queries and URLs of the hosted search and URL context calls, when tool circulation puts them on the wire
  let nFetchUrlsListed = 0; // without those calls (2.x): URL context metadata entries

  // this can throw, it's caught by the caller
  return function(pt: IParticleTransmitter, rawEventData: string): void {

    // Time to first event
    if (timeToFirstEvent === undefined)
      timeToFirstEvent = Date.now() - parserCreationTimestamp;

    // Throws on malformed event data
    const eventData = JSON.parse(rawEventData);

    // In-band error after HTTP 200, Google's error object (https://google.aip.dev/193): {"error":{"code":503,"message":"...","status":"UNAVAILABLE","details":[...]}}
    // [Gemini, 2026-11-09, hypothesis] a bare-string error was never observed: it is surfaced as the message rather than dropped
    if (eventData?.error) {
      pt.addDialectIssue(_geminiInBandErrorIssue(eventData.error), 'srv-warn');
      return pt.setDialectEnded('issue-dialect');
    }

    // [Gemini, 2025-10-22] Early detection of proxy errors - being sent as an assistant message
    if (eventData?.candidates?.length === 1) {
      const finishReason = eventData.candidates[0]?.finishReason;
      if (typeof finishReason === 'string')

        // FIXME: potential point for throwing OperationRetrySignal (using 'srv-warn' for now)
        //        in case of transient errors (502, 503, proxy queue, etc.) - not for good codes.

        // the string is free text, not a code: it goes to `detail`, and there is no `causeCode`
        switch (true) {
          case finishReason.includes('503 Service Unavailable'):
          case finishReason.startsWith('Proxy error'):
            pt.addDialectIssue({ text: 'The service\'s internal proxy failed.', detail: finishReason }, 'srv-warn');
            return pt.setDialectEnded('issue-dialect');

          case finishReason.startsWith('Proxy queue error'):
            pt.addDialectIssue({ text: 'The service\'s internal proxy queue failed.', detail: finishReason }, 'srv-warn');
            return pt.setDialectEnded('issue-dialect');

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

    // -> Stats - before candidates to endings won't interfere/block; an empty usage block (blocked prompt) carries none
    if (generationChunk.usageMetadata?.promptTokenCount !== undefined) {
      const metricsUpdate: AixWire_Particles.CGSelectMetrics = {
        // tool-use prompt tokens (code execution) bill as input, outside promptTokenCount
        TIn: generationChunk.usageMetadata.promptTokenCount + (generationChunk.usageMetadata.toolUsePromptTokenCount ?? 0),
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
        if ((metricsUpdate.TIn ?? 0) >= metricsUpdate.TCacheRead)
          metricsUpdate.TIn = (metricsUpdate.TIn ?? 0) - metricsUpdate.TCacheRead;
      }

      // Served tier -> confirmed price multiplier
      const $xPrice = _gemPriceMultiplier(generationChunk.usageMetadata.serviceTier);
      if ($xPrice !== undefined)
        metricsUpdate.$xPrice = $xPrice;

      if (isStreaming && timeToFirstEvent !== undefined)
        metricsUpdate.dtStart = timeToFirstEvent;

      // the first end-1 packet will be skipped (when streaming)
      if (!skipComputingTotalsOnce) {
        metricsUpdate.dtAll = Date.now() - parserCreationTimestamp;
        // non-streaming: no dtInner - the first event is the whole response, so (dtAll - timeToFirstEvent) is just our parse time
        if (isStreaming && metricsUpdate.TOut)
          metricsUpdate.vTOutInner = Math.round(100 * 1000 /*ms/s*/ * metricsUpdate.TOut / (metricsUpdate.dtInner || metricsUpdate.dtAll)) / 100;
      }
      // the second (end) packet will be sent
      skipComputingTotalsOnce = false;

      pt.updateMetrics(metricsUpdate);
    }

    // -> Prompt Safety Blocking: the service's filter stopped the request before any output: a filter stop, as a blocked
    // response is (stored stop reason 'filter', the rephrase advice), with the block reason as the cause
    if (generationChunk.promptFeedback?.blockReason) {
      const { blockReason, safetyRatings } = generationChunk.promptFeedback;
      // a block reason that is not code-shaped is dropped from `causeCode`: it then leads the detail
      const detail = [aixIssueCodeShaped(blockReason) ? undefined : blockReason, _explainGeminiSafetyIssues(safetyRatings)].filter(Boolean).join(' - ');
      pt.setTokenStopReason('filter-content');
      pt.addDialectIssue({ code: 'model-filter', text: 'The input was not allowed.', causeCode: blockReason, detail: detail || undefined });
      return pt.setDialectEnded('issue-dialect');
    }

    // candidates may be an optional field (started happening on 2024-09-27)
    if (generationChunk.candidates?.length) {

      // We request one completion (candidateCount is 1): candidates[0].
      const [candidate0, ...extraCandidates] = generationChunk.candidates;
      if (candidate0.index !== undefined && candidate0.index !== 0)
        throw new Error(`expected completion index 0, got ${candidate0.index}`);


      // [Gemini, 2026-11] On TOO_MANY_TOOL_CALLS with hosted tools, the aborted step's toolResponse parts arrive as extra index-less candidates,
      // one per pending toolCall in candidates[0]: flushed server-side state, not alternative completions (#1286).
      // Their parts are folded in wire order; anything else on an extra candidate is a shape we have not seen (strict in dev, warns in prod).
      for (const extra of extraCandidates)
        if (extra.finishReason || extra.groundingMetadata || extra.urlContextMetadata || extra.citationMetadata ||
          extra.content?.parts?.some(part => !('toolCall' in part) && !('toolResponse' in part) && !('codeExecutionResult' in part))
        ) // code execution: the pending executableCode's result
          aixResilientUnknownValue('Gemini', 'extraCandidate', extra);

      // -> Candidates -> Content: the completion's parts, then the extra candidates' parts
      for (const mPart of generationChunk.candidates.flatMap(candidate => candidate.content?.parts || [])) {

        // [Gemini 3, 2025-11-18] Extract thoughtSignature once (can appear on any part type)
        // https://ai.google.dev/gemini-api/docs/gemini-3?thinking=high#thought_signatures
        const thoughtSignature = ('thoughtSignature' in mPart && mPart.thoughtSignature) ? mPart.thoughtSignature : undefined;

        switch (true) {

          // <- TextPart
          case 'text' in mPart:
            // [Gemini, 2025-01-23] CoT support
            if (mPart.thought) {
              pt.appendReasoningText(mPart.text || '', collapsedTextPartForReasoning ? { restart: true } : undefined);
              collapsedTextPartForReasoning = false;
            } else {
              // NOTE: considering the below, but not yet
              // don't send an empty text part, which may happen in between reasoning parts
              // and this way we can merge them
              // if (mPart.text?.length)
              if (!COLLAPSE_EMPTY_TEXT_PARTS || mPart.text)
                pt.appendText(mPart.text || '');
              else
                collapsedTextPartForReasoning = true;
            }
            break;

          // <- InlineDataPart
          case 'inlineData' in mPart:
            if (!mPart.inlineData.data) break; // 0-byte code-execution file: no bytes to deliver
            // [Gemini, 2025-03-14] Experimental Image generation: Response
            if (mPart.inlineData.mimeType.startsWith('image/')) {
              pt.appendImageInline(
                mPart.inlineData.mimeType,
                mPart.inlineData.data,
                'Gemini Generated Image',
                'Gemini',
                '', // IMPORTANT: we don't have the prompt with Gemini - set it to empty
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
                pt.addDialectIssue({ code: 'dispatch-parse', text: 'The generated audio could not be converted.', detail: error instanceof Error ? error.message : String(error) }, 'srv-warn');
                pt.setDialectEnded('issue-dialect');
              }
            } else {
              // [Gemini, 2026-06] Code-execution file artifacts (PDF, CSV, xlsx, ...) arrive as inline base64.
              // Unlike Anthropic/OpenAI (server-hosted, re-fetchable by id), Gemini sends the bytes once with no
              // handle - so hand them to the client as a fire-and-forget download instead of terminating the turn.
              pt.appendHostedResource({
                p: 'hres',
                kind: 'inline-download',
                mimeType: mPart.inlineData.mimeType,
                b64: mPart.inlineData.data,
                ...(mPart.inlineData.displayName ? { filename: mPart.inlineData.displayName } : {}),
              });
            }
            break;

          // <- FunctionCallPart
          case 'functionCall' in mPart:
            let { id: fcId, name: fcName, args: fcArgs } = mPart.functionCall;

            // [DEV] Track whether Gemini always provides IDs - if confirmed, make schema fields required
            if (DEV_DEBUG_MISSING_IDS && !fcId)
              console.log('[DEV] Gemini functionCall missing id for:', fcName);

            // Validate the function call arguments - we expect a JSON object, not just any JSON value
            if (!fcArgs || typeof fcArgs !== 'object')
              console.warn(`[Gemini] Invalid function call arguments: ${JSON.stringify(fcArgs)} for ${fcName}`);
            else
              pt.startFunctionCallInvocation(fcId ?? null, fcName, 'json_object', fcArgs);
            pt.endMessagePart();
            break;

          // <- ExecutableCodePart
          case 'executableCode' in mPart:
            // [DEV] Track whether Gemini always provides IDs - if confirmed, make schema fields required
            if (DEV_DEBUG_MISSING_IDS && !mPart.executableCode.id)
              console.log('[DEV] Gemini executableCode missing id');
            pt.addCodeExecutionInvocation(mPart.executableCode.id ?? null, mPart.executableCode.language || '', mPart.executableCode.code || '', 'gemini_auto_inline');
            pt.updateMetrics({ nCodeExec: ++nCodeExec }); // counted, not per-call billed
            break;

          // <- CodeExecutionResultPart
          case 'codeExecutionResult' in mPart:
            const ceId = mPart.codeExecutionResult.id ?? null;
            // [DEV] Track whether Gemini always provides IDs - if confirmed, make schema fields required
            if (DEV_DEBUG_MISSING_IDS && !ceId)
              console.log('[DEV] Gemini codeExecutionResult missing id');
            switch (mPart.codeExecutionResult.outcome) {
              case 'OUTCOME_OK':
                pt.addCodeExecutionResponse(ceId, false, mPart.codeExecutionResult.output || '', 'gemini_auto_inline', 'upstream');
                break;
              case 'OUTCOME_FAILED':
                pt.addCodeExecutionResponse(ceId, true, mPart.codeExecutionResult.output || '', 'gemini_auto_inline', 'upstream');
                break;
              case 'OUTCOME_DEADLINE_EXCEEDED':
                const deadlineError = 'Code execution deadline exceeded' + (mPart.codeExecutionResult.output ? `: ${mPart.codeExecutionResult.output}` : '');
                pt.addCodeExecutionResponse(ceId, deadlineError, '', 'gemini_auto_inline', 'upstream');
                break;
              default:
                const _exhaustiveCheck: never = mPart.codeExecutionResult.outcome;
                aixResilientUnknownValue('Gemini', 'codeExecutionOutcome', mPart.codeExecutionResult.outcome);
                break;
            }
            break;

          // <- ToolCallPart (server-side hosted tool invocation, e.g. Google Search, URL Context)
          case 'toolCall' in mPart: {
            const tc = mPart.toolCall;
            // the calls say what ran: every query (a repeated query is a new search) and every URL.
            // [Gemini, 2026-11-05, hypothesis] counted in queries because the pricing page bills each executed query on Gemini 3+;
            // that is not verifiable, and Google's own limit message counts calls, of which one can carry several queries.
            // The candidate metadata is not a count: grounding lists only the queries whose results were used and is absent when
            // the turn ends on a function call, URL context drops entries (failed retrievals, later steps)
            if (tc.toolType === 'GOOGLE_SEARCH_WEB') {
              nSearchQueries += _geminiStrArray(_geminiAsObj(tc.args)?.queries)?.length ?? 0;
              if (nSearchQueries) pt.updateMetrics({ nWebSearch: nSearchQueries });
            } else if (tc.toolType === 'URL_CONTEXT') {
              nFetchUrls += _geminiStrArray(_geminiAsObj(tc.args)?.urls)?.length ?? 0;
              if (nFetchUrls) pt.updateMetrics({ nWebFetch: nFetchUrls }); // counted, not per-call billed (#1283)
            }
            if (!tc.id) {
              if (DEV_DEBUG_MISSING_IDS) console.log('[DEV] Gemini toolCall missing id for:', tc.toolType);
              break;
            }
            const cfg = _geminiGetServerToolConfig(tc.toolType);
            const parsed = cfg.parseArgs?.(tc.args);
            const statusText = parsed?.text ?? cfg.callLabel;
            const iTexts = parsed?.iTexts ?? (tc.args ? [_geminiJsonSummary(tc.args)].filter(Boolean) as string[] : undefined);

            pt.sendOperationState(cfg.mot, statusText, { opId: tc.id, ...(iTexts?.length ? { iTexts } : {}) });
            break;
          }

          // <- ToolResponsePart (server-side hosted tool result)
          case 'toolResponse' in mPart: {
            const tr = mPart.toolResponse;
            if (!tr.id) {
              if (DEV_DEBUG_MISSING_IDS) console.log('[DEV] Gemini toolResponse missing id for:', tr.toolType);
              break;
            }
            const cfg = _geminiGetServerToolConfig(tr.toolType);
            const oTexts = cfg.parseResponse?.(tr.response)?.oTexts;

            pt.sendOperationState(cfg.mot, cfg.doneLabel, { opId: tr.id, state: 'done', ...(oTexts?.length ? { oTexts } : {}) });
            break;
          }

          default:
            // noinspection JSUnusedLocalSymbols
            const _exhaustiveCheck: never = mPart;
            aixResilientUnknownValue('Gemini', 'contentPartType', mPart);
            break;
        }

        // Set the thought signature if available
        thoughtSignature && pt.sendSetVendorState({ p: 'svs', vendor: 'gemini', state: { thoughtSignature } });
      }

      // -> Candidates[0] -> Safety Ratings
      // read only at a filter finish: all of them for SAFETY and IMAGE_SAFETY, the blocked ones for the other filter rows

      // -> Candidates[0] -> Citation Metadata
      // this is automated recitation detection by the API, not explicit grounding - very weak signal - as websites appear to be poor quality
      if (ENABLE_RECITATIONS_AS_CITATIONS && candidate0.citationMetadata?.citationSources?.length) {
        for (let { startIndex, endIndex, uri /*, license*/ } of candidate0.citationMetadata.citationSources) {
          // TODO: have a particle/part flag to state the purpose of a citation? (e.g. 'recitation' is weaker than 'grounding')
          pt.appendUrlCitation('', uri || '', undefined, startIndex, endIndex, undefined, undefined);
        }
      }

      // -> Candidates[0] -> Grounding Metadata: the queries used, counted when the search calls are not on the wire (no tool circulation: 2.x, image models)
      if (!nSearchQueries && candidate0.groundingMetadata?.webSearchQueries?.length)
        pt.updateMetrics({ nWebSearch: candidate0.groundingMetadata.webSearchQueries.length });
      if (candidate0.groundingMetadata?.groundingChunks?.length) {
        /**
         * TODO: improve parsing of grounding metadata, including:
         * - annotations and ranges .groundingSupports
         * - sort chunks by their overal confidence in the .groundingSupports?
         * - follow up Google Search queries (.webSearchQueries)
         * - follow up Google Search queries (.webSearchQueries) for suggested refinements
         */
        for (const { web } of candidate0.groundingMetadata.groundingChunks)
          pt.appendUrlCitation(web.title, web.uri, _citationRefNumber(groundingRefNumbers, web.uri), undefined, undefined, undefined, undefined);
      }

      // -> Candidates[0] -> URL Context Metadata
      if (candidate0.urlContextMetadata?.urlMetadata?.length) {
        if (!nFetchUrls) // fetches without the URL context calls on the wire (2.x): this list, which then comes once per fetch step
          pt.updateMetrics({ nWebFetch: nFetchUrlsListed += candidate0.urlContextMetadata.urlMetadata.length });
        for (const urlMeta of candidate0.urlContextMetadata.urlMetadata) {
          // Only add URLs that were successfully retrieved
          if (urlMeta.urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_SUCCESS')
            pt.appendUrlCitation('', urlMeta.retrievedUrl, _citationRefNumber(groundingRefNumbers, urlMeta.retrievedUrl), undefined, undefined, undefined, undefined);
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
            // FORMER NOTE:
            // this is expected for every fragment up to the end, when it may switch to one of the reasons below in the last packet
            // we cannot assume this signals a good ending, however it will be `pt` to set it to 'ok' if not set to an issue by the end

            // NEW NOTE:
            // 'STOP' seems to only be sent at the end now
            pt.setTokenStopReason('ok');
            pt.setDialectEnded('done-dialect'); // Gemini: generation finished successfully
            break;

          case 'MAX_TOKENS':
          case 'CONTINUATION': // Per-request token limit reached before the end; we do not resume with continuationToken, so the output is cut
            pt.setTokenStopReason('out-of-tokens');
            // no issue: the out-of-tokens stop reason says it
            pt.setDialectEnded('issue-dialect'); // Gemini: max tokens reached
            break;

          // a filter stop: the stop reason, then the issue that explains it; a failure: 'cg-issue' and one issue
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
          case 'MISSING_THOUGHT_SIGNATURE': // [Gemini 3] Thinking model validation failed - thoughtSignature missing
          case 'MALFORMED_RESPONSE': // Finished due to malformed response
          case 'ESCALATION': // Request was filtered by an escalation rule
          case 'PUP_LIMITED_DISABLED': // User account limited or disabled for Prohibited Use Policy (PUP) violations
          case 'FINISH_REASON_UNSPECIFIED':
            // `text` of a failure is our sentence when the vendor sent no finishMessage; a filter's sentence is the stop reason's, except where it misdescribes the stop
            const finishRows: Record<typeof candidate0.finishReason, { stop: Extract<AixWire_Particles.GCTokenStopReason, `filter-${string}`>, text?: string } | { stop: 'cg-issue', text: string }> = {
              'SAFETY': { stop: 'filter-content' },
              'RECITATION': { stop: 'filter-recitation' },
              'LANGUAGE': { stop: 'filter-refusal', text: 'The language is not supported.' },
              'OTHER': { stop: 'cg-issue', text: 'The generation stopped for an unknown reason.' },
              'BLOCKLIST': { stop: 'filter-content' },
              'PROHIBITED_CONTENT': { stop: 'filter-content' },
              'SPII': { stop: 'filter-content' },
              'MALFORMED_FUNCTION_CALL': { stop: 'cg-issue', text: 'The model generated an invalid function call.' },
              'IMAGE_SAFETY': { stop: 'filter-content' },
              'IMAGE_PROHIBITED_CONTENT': { stop: 'filter-content' },
              'IMAGE_RECITATION': { stop: 'filter-recitation' },
              'IMAGE_OTHER': { stop: 'cg-issue', text: 'The image generation stopped for an unknown reason.' },
              'NO_IMAGE': { stop: 'cg-issue', text: 'No image was generated.' },
              'UNEXPECTED_TOOL_CALL': { stop: 'cg-issue', text: 'The model called a tool, but no tools were enabled.' },
              'TOO_MANY_TOOL_CALLS': { stop: 'cg-issue', text: 'The model made too many consecutive tool calls.' },
              'MISSING_THOUGHT_SIGNATURE': { stop: 'cg-issue', text: 'The request is missing at least one thought signature.' },
              'MALFORMED_RESPONSE': { stop: 'cg-issue', text: 'The response was malformed.' },
              'ESCALATION': { stop: 'filter-content' },
              'PUP_LIMITED_DISABLED': { stop: 'cg-issue', text: 'The account is limited or disabled for Prohibited Use Policy violations.' },
              'FINISH_REASON_UNSPECIFIED': { stop: 'cg-issue', text: 'The generation stopped and no reason was given.' },
            } as const;
            const finishRow = finishRows[candidate0.finishReason];
            if (finishRow.stop !== 'cg-issue') {
              // the ratings explain a safety stop; on the other rows a routine rating is not the cause, a blocked one is.
              // Ratings first: the detail is bounded from the end, and a long finishMessage must not cut them
              const ratings = _explainGeminiSafetyIssues(candidate0.safetyRatings, candidate0.finishReason !== 'SAFETY' && candidate0.finishReason !== 'IMAGE_SAFETY');
              pt.setTokenStopReason(finishRow.stop);
              pt.addDialectIssue({
                code: 'model-filter',
                text: finishRow.text,
                causeCode: candidate0.finishReason,
                detail: [ratings, candidate0.finishMessage].filter(Boolean).join(' - ') || undefined,
              });
              return pt.setDialectEnded('issue-dialect');
            }
            pt.setTokenStopReason('cg-issue');
            pt.addDialectIssue({ text: candidate0.finishMessage || finishRow.text, causeCode: candidate0.finishReason });
            return pt.setDialectEnded('issue-dialect');

          default:
            // Exhaustiveness check - if we get here, Gemini added a new finishReason
            const _exhaustiveCheck: never = candidate0.finishReason as Exclude<typeof candidate0.finishReason, string>;
            aixResilientUnknownValue('Gemini', 'finishReason', candidate0.finishReason);
            pt.setTokenStopReason('cg-issue');
            // a finish reason that is not code-shaped is dropped from `causeCode`: it is kept as the detail
            pt.addDialectIssue({
              text: candidate0.finishMessage || 'The generation stopped for a reason this app does not know.',
              causeCode: candidate0.finishReason,
              detail: aixIssueCodeShaped(candidate0.finishReason) ? undefined : candidate0.finishReason,
            }, 'srv-warn');
            return pt.setDialectEnded('issue-dialect');
        }
      }
    } /* end of .candidates */

  };
}


/** The ratings above NEGLIGIBLE (or only the `blocked` ones), highest first, as the vendor names them; undefined when there are none (a PROHIBITED_CONTENT block sends no ratings) */
function _explainGeminiSafetyIssues(safetyRatings: GeminiWire_Safety.SafetyRating[] | undefined, onlyBlocked?: boolean): string | undefined {
  return [...safetyRatings ?? []]
    .sort(_geminiHarmProbabilitySortFunction)
    .filter(rating => onlyBlocked ? rating.blocked === true : rating.probability !== 'NEGLIGIBLE')
    .map(rating => `${rating.category} (${rating.probability?.toLowerCase()})`)
    .join(', ') || undefined;
}

/**
 * Google's error object (https://google.aip.dev/193) as an issue: `text` is the message, `causeCode` the status name (else the code),
 * `detail` the status and code, then each typed `details` entry as `name: value` fields. No HTTP status: the stream was a 200.
 */
function _geminiInBandErrorIssue(error: unknown): ParticleDialectIssue {
  if (!error || typeof error !== 'object')
    return { text: String(error) };
  const { code, message, status, details } = error as { code?: unknown, message?: unknown, status?: unknown, details?: unknown };
  const statusText = typeof status === 'string' && status ? status : undefined;
  const codeText = (typeof code === 'number' || typeof code === 'string') && code !== '' ? String(code) : undefined;

  let retryAfterMs: number | undefined;
  const entries = !Array.isArray(details) ? [] : details.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return String(entry);
    const { '@type': type, ...fields } = entry as Record<string, unknown>;
    // RetryInfo.retryDelay is a Duration, '41s' or '1.5s'
    const delay = typeof fields.retryDelay === 'string' ? /^(\d+(?:\.\d+)?)s$/.exec(fields.retryDelay) : null;
    if (delay) retryAfterMs = Math.round(parseFloat(delay[1]) * 1000);
    const values = Object.entries(fields).map(([name, value]) => `${name}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join(', ');
    const typeName = typeof type === 'string' ? type.split('.').at(-1) : undefined;
    return typeName ? `${typeName} (${values})` : values;
  });

  const detail = [
    [statusText, codeText !== undefined && `(${codeText})`].filter(Boolean).join(' '),
    entries.join('; '),
  ].filter(Boolean).join(' - ');
  return {
    text: typeof message === 'string' ? message : undefined, // none: the record's own sentence
    ...(detail && { detail }),
    causeCode: statusText ?? codeText,
    ...(retryAfterMs !== undefined && { retryAfterMs }),
  };
}

function _geminiHarmProbabilitySortFunction(a: { probability: string }, b: { probability: string }) {
  const order = ['NEGLIGIBLE', 'LOW', 'MEDIUM', 'HIGH'];
  return order.indexOf(b.probability) - order.indexOf(a.probability);
}


// --- Gemini Hosted Tools (server-side tool invocations) ---

// Exhaustive config for all known ServerToolType values.
// Adding a value to _ServerToolType_enum in gemini.wiretypes.ts without updating this map is a compile error.

type _GeminiServerToolConfig = {
  mot: 'search-web' | 'code-exec',
  callLabel: string,
  doneLabel: string,
  parseArgs?: (args: unknown) => { text: string, iTexts?: string[] },
  parseResponse?: (response: unknown) => { oTexts?: string[] },
};

// Wire format (verified): search tools use { queries: string[] }, e.g. { queries: ["\"Enrico Ros\"", "\"Enrico Ros\" tech"] }
// Wire format (verified): toolResponse contains grounding data (+ searchEntryPoint HTML which we skip)
// NOTE: when includeServerSideToolInvocations is true, grounding data may be in toolResponse
// instead of candidate.groundingMetadata - citations are still extracted from groundingMetadata if present

/** Shared parseArgs for query-based tools (search web/images/files) */
function _geminiParseQueryArgs(label: string, iTextPrefix: string): NonNullable<_GeminiServerToolConfig['parseArgs']> {
  return (args) => {
    const a = _geminiAsObj(args);
    const queries = _geminiStrArray(a?.queries) || _geminiStrArray(a?.query ? [a.query] : undefined);
    return queries?.length
      ? { text: label, iTexts: queries.map(q => `${iTextPrefix}: "${q}"`) }
      : { text: label };
  };
}

const _geminiServerToolConfigs: Record<GeminiWire_ContentParts.ServerToolType, _GeminiServerToolConfig> = {
  'GOOGLE_SEARCH_WEB': {
    mot: 'search-web',
    callLabel: 'Searching the web...',
    doneLabel: 'Search completed',
    parseArgs: _geminiParseQueryArgs('Searching the web...', 'Search query'),
  },
  'GOOGLE_SEARCH_IMAGE': {
    mot: 'search-web',
    callLabel: 'Searching images...',
    doneLabel: 'Image search completed',
    parseArgs: _geminiParseQueryArgs('Searching images...', 'Search query'),
  },
  'URL_CONTEXT': {
    mot: 'search-web',
    callLabel: 'Fetching web content...',
    doneLabel: 'Retrieved content',
    // Wire format (verified): { urls: string[] } e.g. { urls: ["https://big-agi.com"] }
    parseArgs: (args) => {
      const a = _geminiAsObj(args);
      const urls = _geminiStrArray(a?.urls);
      return urls?.length
        ? { text: `Fetching ${urls[0]}...`, iTexts: urls.map(u => `URL: ${u}`) }
        : { text: 'Fetching web content...' };
    },
    // Wire format (verified): { url_metadata: [{ retrieved_url: string, url_retrieval_status: string }] }
    parseResponse: (response) => {
      const r = _geminiAsObj(response);
      const urlMetadata = Array.isArray(r?.url_metadata) ? r.url_metadata as Record<string, unknown>[] : [];
      const urls = urlMetadata
        .filter(m => m.url_retrieval_status === 'URL_RETRIEVAL_STATUS_SUCCESS')
        .map(m => _geminiStr(m.retrieved_url))
        .filter((u): u is string => !!u);
      return urls.length ? { oTexts: urls } : {};
    },
  },
  'GOOGLE_MAPS': {
    mot: 'search-web',
    callLabel: 'Looking up location...',
    doneLabel: 'Maps lookup completed',
  },
  'FILE_SEARCH': {
    mot: 'search-web',
    callLabel: 'Searching files...',
    doneLabel: 'File search completed',
    parseArgs: _geminiParseQueryArgs('Searching files...', 'Search query'),
  },
};


function _geminiGetServerToolConfig(toolType: string): _GeminiServerToolConfig {
  return _geminiServerToolConfigs[toolType as GeminiWire_ContentParts.ServerToolType] ?? {
    mot: 'search-web',
    callLabel: `Using ${toolType}...`,
    doneLabel: `${toolType} completed`,
  };
}

// Helpers for speculative arg/response parsing

function _geminiAsObj(v: unknown): Record<string, unknown> | null {
  return (v && typeof v === 'object' && !Array.isArray(v)) ? v as Record<string, unknown> : null;
}

function _geminiStr(v: unknown): string | undefined {
  return typeof v === 'string' && v.length ? v : undefined;
}

function _geminiStrArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const strings = v.filter((s): s is string => typeof s === 'string' && s.length > 0);
  return strings.length ? strings : undefined;
}

/** Summarize an unknown JSON value for iTexts/oTexts display (keeps start + end, shows char count in the middle) */
function _geminiJsonSummary(v: unknown, maxLen = 512): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = JSON.stringify(v);
  if (s.length <= maxLen) return s;
  const ellipsis = `...[${(s.length - maxLen).toLocaleString()} chars]...`;
  const half = Math.floor((maxLen - ellipsis.length) / 2);
  return s.slice(0, half) + ellipsis + s.slice(-half);
}


/** Served tier -> confirmed multiplier: standard 1x, flex and batch 0.5x, priority 1.8x */
function _gemPriceMultiplier(serviceTier: string | null | undefined): number | undefined {
  switch (serviceTier) {
    case 'standard':
      return 1;
    case 'flex':
    case 'batch':
      return 0.5;
    case 'priority':
      return 1.8;
    default:
      return undefined;
  }
}


/**
 * Citation numbers follow first appearance, one per URI: grounding chunks repeat across stream events (and a page across
 * chunks), the client coalesces citations by URL, so a running counter left gaps and a top number above the count (#1270).
 */
function _citationRefNumber(refNumbers: Map<string, number>, uri: string): number {
  const existing = refNumbers.get(uri);
  if (existing !== undefined) return existing;
  const refNumber = refNumbers.size + 1;
  refNumbers.set(uri, refNumber);
  return refNumber;
}
