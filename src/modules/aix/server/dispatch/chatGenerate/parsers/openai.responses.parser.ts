import { safeErrorString } from '~/server/wire';
import { serverSideId } from '~/server/trpc/trpc.nanoid';

import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter } from '../IParticleTransmitter';
import { IssueSymbols } from '../ChatGenerateTransmitter';

import { OpenAIWire_API_Responses } from '../../wiretypes/openai.wiretypes';


/**
 * OpenAI Responses API Streaming Parser
 *
 * OpenAI uses a chunk-based streaming protocol for its chat completions:
 * 1. Each chunk contains a 'choices' array, typically with a single item.
 * 2. The 'delta' field in each choice contains incremental updates to the message.
 * 3. Text content is streamed as string fragments in delta.content.
 * 4. Tool calls (function calls) are streamed incrementally in delta.tool_calls.
 * 5. There may be a final chunk which may contain a 'finish_reason' - but we won't rely on it.
 *
 * Assumptions:
 * - 'text' parts are incremental
 * - 'functionCall' are streamed incrementally, but follow a scheme.
 *    1. the firs delta chunk contains the the full ID and name of the function, and likley empty arguments.
 *    2. Subsequent delta chunks will only contain incremental text for the arguments.
 * - Begin/End: at any point:
 *    - it's either streaming Text or Tool Calls on each chunk
 *    - and there can be multiple chunks for a single completion (e.g. a text chunk and a tool call 1 chunk)
 *    - the temporal order of the chunks implies the beginning/end of a tool call.
 * - There's no explicit end in this data protocol, but it's handled in the caller with a sse:[DONE] event.
 */
export function createOpenAIResponsesEventParser(): ChatGenerateParseFunction {

  const parserCreationTimestamp = Date.now();
  let hasBegun = false;
  let hasWarned = false;
  let timeToFirstEvent: number | undefined;
  let progressiveCitationNumber = 1;
  // let perplexityAlreadyCited = false;
  let processedSearchResultUrls = new Set<string>();
  // NOTE: could compute rate (tok/s) from the first textful event to the last (to ignore the prefill time)

  // Supporting structure to accumulate the assistant message
  const accumulator: {
    content: string | null;
    tool_calls: {
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string | null;
      };
    }[];
  } = {
    content: null,
    tool_calls: [],
  };

  return function(pt: IParticleTransmitter, eventData: string) {

    // Time to first event
    if (timeToFirstEvent === undefined)
      timeToFirstEvent = Date.now() - parserCreationTimestamp;

    // Throws on malformed event data
    const chunkData = JSON.parse(eventData);

    // Streaming parser
    const event = OpenAIWire_API_Responses.StreamingEvent_schema.parse(chunkData);
    const eventType = event?.type;
    console.log(eventType);
    switch (eventType) {
      case 'response.created':
        break;
      case 'response.in_progress':
        break;
      case 'response.completed':
        break;
      case 'response.failed':
        break;
      case 'response.incomplete':
        break;
      case 'response.output_item.added':
        break;
      case 'response.output_item.done':
        break;
      case 'response.content_part.added':
        break;
      case 'response.content_part.done':
        break;
      case 'response.output_text.delta':
        break;
      case 'response.output_text.done':
        break;
      case 'response.output_refusal.delta':
        break;
      case 'response.output_refusal.done':
        break;
      case 'response.output_text_annotation.added':
        break;
      case 'response.reasoning.delta':
        break;
      case 'response.reasoning.done':
        break;
      case 'response.reasoning_summary.delta':
        break;
      case 'response.reasoning_summary.done':
        break;
      case 'response.reasoning_summary_part.added':
        break;
      case 'response.reasoning_summary_part.done':
        break;
      case 'response.reasoning_summary_text.delta':
        break;
      case 'response.reasoning_summary_text.done':
        break;
      case 'response.function_call_arguments.delta':
        break;
      case 'response.function_call_arguments.done':
        break;
      case 'error':
        break;

      default:
        const _exhaustiveCheck: never = eventType;
        console.warn('[DEV] AIX: OpenAI-dispatch: unexpected event type:', eventType);
        break;
    }


    // // -> Model
    // if (!hasBegun && json.model) {
    //   hasBegun = true;
    //   pt.setModelName(json.model);
    // }
    //
    // // [OpenAI] an upstream error will be handled gracefully and transmitted as text (throw to transmit as 'error')
    // if (json.error) {
    //   return pt.setDialectTerminatingIssue(safeErrorString(json.error) || 'unknown.', IssueSymbols.Generic);
    // }
    //
    // // [OpenAI] if there's a warning, log it once
    // if (json.warning && !hasWarned) {
    //   hasWarned = true;
    //   console.log('AIX: OpenAI-dispatch chunk warning:', json.warning);
    // }
    //
    // // [Azure] we seem to get 'prompt_annotations' or 'prompt_filter_results' objects - which we will ignore to suppress the error
    // if (json.id === '' && json.object === '' && json.model === '')
    //   return;
    //
    //
    // // -> Stats
    // if (json.usage) {
    //   const metrics = _fromOpenAIUsage(json.usage, parserCreationTimestamp, timeToFirstEvent);
    //   if (metrics)
    //     pt.updateMetrics(metrics);
    //   // [OpenAI] Expected correct case: the last object has usage, but an empty choices array
    //   if (!json.choices.length)
    //     return;
    // }
    // // [Groq] -> Stats
    // // Note: if still in queue, reset the event stats, until we're out of the queue
    // if (json.x_groq?.queue_length)
    //   timeToFirstEvent = undefined;
    // if (json.x_groq?.usage) {
    //   const { prompt_tokens, completion_tokens, completion_time } = json.x_groq.usage;
    //   const metricsUpdate: AixWire_Particles.CGSelectMetrics = {
    //     TIn: prompt_tokens,
    //     TOut: completion_tokens,
    //     vTOutInner: (completion_tokens && completion_time) ? Math.round((completion_tokens / completion_time) * 100) / 100 : undefined,
    //     dtInner: Math.round((completion_time || 0) * 1000),
    //     dtAll: Date.now() - parserCreationTimestamp,
    //   };
    //   if (timeToFirstEvent !== undefined)
    //     metricsUpdate.dtStart = timeToFirstEvent;
    //   pt.updateMetrics(metricsUpdate);
    // }
    //
    // // expect: 1 completion, or stop
    // if (json.choices.length !== 1)
    //   throw new Error(`expected 1 completion, got ${json.choices.length}`);
    //
    //
    // // [Perplexity] .search_results
    // if (json.search_results && Array.isArray(json.search_results)) {
    //
    //   // Process only new search results
    //   for (const searchResult of json.search_results) {
    //
    //     // Incremental processing
    //     const url = searchResult?.url;
    //     if (!url || processedSearchResultUrls.has(url))
    //       continue;
    //     processedSearchResultUrls.add(url);
    //
    //     // Append the new citation
    //     let pubTs: number | undefined;
    //     if (searchResult.date) {
    //       const date = new Date(searchResult.date);
    //       if (!isNaN(date.getTime()))
    //         pubTs = date.getTime();
    //     }
    //     pt.appendUrlCitation(searchResult.title || '', url, progressiveCitationNumber++, undefined, undefined, undefined, pubTs);
    //   }
    //
    // }
    // // [Perplexity] .citations (DEPRECATED)
    // // if (json.citations && !perplexityAlreadyCited && Array.isArray(json.citations)) {
    // //
    // //   for (const citationUrl of json.citations)
    // //     if (typeof citationUrl === 'string')
    // //       pt.appendUrlCitation('', citationUrl, progressiveCitationNumber++, undefined, undefined, undefined);
    // //
    // //   // Perplexity detection: streaming of full objects, hence we don't re-send the citations at every chunk
    // //   if (json.object === 'chat.completion')
    // //     perplexityAlreadyCited = true;
    // //
    // // }
    //
    //
    // for (const { index, delta, finish_reason } of json.choices) {
    //
    //   // n=1 -> single Choice only
    //   if (index !== 0 && index !== undefined /* [OpenRouter->Gemini] */)
    //     throw new Error(`expected completion index 0, got ${index}`);
    //
    //   // handle missing content
    //   if (!delta)
    //     throw new Error(`server response missing content (finish_reason: ${finish_reason})`);
    //
    //   // delta: Reasoning Content [Deepseek, 2025-01-20]
    //   let deltaHasReasoning = false;
    //   if (typeof delta.reasoning_content === 'string') {
    //
    //     pt.appendReasoningText(delta.reasoning_content);
    //     deltaHasReasoning = true;
    //
    //   }
    //   // delta: Reasoning [OpenRouter, 2025-01-24]
    //   else if (typeof delta.reasoning === 'string') {
    //
    //     pt.appendReasoningText(delta.reasoning);
    //     deltaHasReasoning = true;
    //
    //   }
    //
    //   // delta: Text
    //   if (typeof delta.content === 'string' &&
    //     (!deltaHasReasoning || delta.content) // suppress if reasoning and empty
    //   ) {
    //
    //     accumulator.content = (accumulator.content || '') + delta.content;
    //     pt.appendAutoText_weak(delta.content);
    //
    //   }
    //   // 2025-03-26: we don't have the full concurrency combinations of content/reasoning/reasoning_content yet
    //   // if (delta.content !== undefined && delta.content !== null)
    //   //   throw new Error(`unexpected delta content type: ${typeof delta.content}`);
    //
    //   // delta: Tool Calls
    //   for (const deltaToolCall of (delta.tool_calls || [])) {
    //
    //     // validation
    //     if (deltaToolCall.type !== undefined && deltaToolCall.type !== 'function')
    //       throw new Error(`unexpected tool_call type: ${deltaToolCall.type}`);
    //
    //     // Creation -  Ensure the tool call exists in our accumulated structure
    //     const tcIndex = deltaToolCall.index ?? accumulator.tool_calls.length;
    //     if (!accumulator.tool_calls[tcIndex]) {
    //       const created = accumulator.tool_calls[tcIndex] = {
    //         id: deltaToolCall.id || serverSideId('aix-tool-call-id'),
    //         type: 'function',
    //         function: {
    //           name: deltaToolCall.function.name || '',
    //           arguments: deltaToolCall.function.arguments || '',
    //         },
    //       };
    //       pt.startFunctionCallInvocation(created.id, created.function.name, 'incr_str', created.function.arguments);
    //       break;
    //     }
    //
    //     // Updating arguments
    //     const accumulatedToolCall = accumulator.tool_calls[tcIndex];
    //
    //     // Validate
    //     if (deltaToolCall.id && deltaToolCall.id !== accumulatedToolCall.id)
    //       throw new Error(`unexpected tool_call id change: ${deltaToolCall.id}`);
    //     if (deltaToolCall.function.name)
    //       throw new Error(`unexpected tool_call name change: ${deltaToolCall.function.name}`);
    //
    //     // It's an arguments update - send it
    //     if (deltaToolCall.function?.arguments) {
    //       accumulatedToolCall.function.arguments += deltaToolCall.function.arguments;
    //       pt.appendFunctionCallInvocationArgs(accumulatedToolCall.id, deltaToolCall.function.arguments);
    //     }
    //
    //   } // .choices.tool_calls[]
    //
    //   // [OpenAI, 2025-03-11] delta: Annotations[].url_citation
    //   if (delta.annotations !== undefined) {
    //
    //     if (Array.isArray(delta.annotations)) {
    //       for (const { type: annotationType, url_citation: urlCitation } of delta.annotations) {
    //         if (annotationType !== 'url_citation')
    //           throw new Error(`unexpected annotation type: ${annotationType}`);
    //         pt.appendUrlCitation(urlCitation.title, urlCitation.url, undefined, urlCitation.start_index, urlCitation.end_index, undefined, undefined);
    //       }
    //     } else {
    //       // we don't abort for this issue - for our users
    //       console.log('AIX: OpenAI-dispatch: unexpected annotations:', delta.annotations);
    //     }
    //
    //   }
    //
    //   // Token Stop Reason - usually missing in all but the last chunk, but we don't rely on it
    //   if (finish_reason) {
    //     const tokenStopReason = _fromOpenAIFinishReason(finish_reason);
    //     if (tokenStopReason !== null)
    //       pt.setTokenStopReason(tokenStopReason);
    //   }
    //
    //   // Note: not needed anymore - Workaround for implementations that don't send the [DONE] event
    //   // if (finish_reason === 'max_tokens')
    //   //   pt.setDialectTerminatingIssue('finish-reason');
    //
    // } // .choices[]

  };
}


/// OpenAI non-streaming ChatCompletions

export function createOpenAIResponseParserNS(): ChatGenerateParseFunction {

  const parserCreationTimestamp = Date.now();
  let progressiveCitationNumber = 1;

  return function(pt: IParticleTransmitter, eventData: string) {

    // Throws on malformed event data
    const responseData = JSON.parse(eventData);

    // .error: transmits upstream errors pre-parsing (object wouldn't be valid)
    if (_forwardResponseError(responseData, pt))
      return;

    // [OpenAI] possibly log the warnings to get more insights on the API
    if (responseData.warning)
      console.log('AIX: OpenAI-Response-NS warning:', responseData.warning);

    // full response parsing
    const response = OpenAIWire_API_Responses.ResponseNS_schema.parse(responseData);

    // -> Model
    if (response.model)
      pt.setModelName(response.model);

    // -> Stats
    if (response.usage) {
      const metrics = _fromResponseUsage(response.usage, parserCreationTimestamp, undefined);
      if (metrics)
        pt.updateMetrics(metrics);
    }

    // -> Status
    switch (response.status) {
      case 'completed':
        // expected: the response is complete
        break;

      case 'incomplete':
        // pedantic check (.incomplete_details)
        if (response.incomplete_details && typeof response.incomplete_details === 'object') {

          // append the incomplete details as text
          pt.appendText(`**Incomplete response**: the response was incomplete because ${response.incomplete_details?.reason || 'unknown reason'}\n`);
          console.warn('[DEV] AIX: OpenAI-Response-NS response incomplete:', { incomplete_details: response.incomplete_details });

        } else {
          // unexpected: we don't expect to receive lifecycle-partial responses in the non-streaming mode
          console.warn('[DEV] AIX: OpenAI-Response-NS unexpected incomplete response details:', { response });
          // not sure what to parse if we get here?
        }
        break;

      case 'cancelled':
      case 'in_progress':
      case 'queued':
        // unexpected: we don't expect to receive lifecycle-partial responses in the non-streaming mode
        console.warn('[DEV] AIX: OpenAI-Response-NS unexpected response status:', { response });
        // not sure what to parse if we get here?
        break;

      case 'failed':
        // TODO: check the full response for the error
        console.log('[DEV] AIX: OpenAI-Response-NS response failed:', { response });
        break;

      default:
        const _exhaustiveCheck: never = response.status;
        console.warn('[DEV] AIX: OpenAI-Response-NS unexpected response status:', { status: response.status });
        break;
    }

    // say it's okay for now
    pt.setTokenStopReason('ok')


    // -> Output[]
    for (const oItem of response.output) {

      // NOTE: we ignore the status field, as it's partial (only in message, not reasoning)
      //       and wrong (in 'message' items it still shows as 'in_progress' despite being
      //       done in the response)
      // pedantic check on status
      // switch (oItem.status) {
      //   case 'completed':
      //     break;
      //
      //   case 'in_progress':
      //   case 'incomplete':
      //     console.warn('[DEV] AIX: OpenAI-Response-NS unexpected output item status:', oItem.status);
      //     break;
      //
      //   default:
      //     console.warn('[DEV] AIX: OpenAI-Response-NS unexpected output item status:', oItem.status);
      //     break;
      // }

      const oItemType = oItem.type;
      switch (oItemType) {

        // Reasoning contains all the reasoning summaries (if present)
        case 'reasoning':
          const {
            // id: reasoningId,
            summary: reasoningSummary,
            // encrypted_content: reasoningEC,
          } = oItem;

          // pedantic check
          if (!Array.isArray(reasoningSummary)) {
            console.warn('[DEV] AIX: OpenAI-Response-NS unexpected reasoning summary type:', { reasoningSummary });
            break;
          }

          // TODO: implement once we know how this looks like
          for (const item of reasoningSummary) {
            if (!item.text) {
              console.warn('[DEV] AIX: OpenAI-Response-NS unexpected reasoning summary item:', { item });
              continue;
            }
            pt.appendReasoningText(item.text);
          }
          break;

        // Message contains the main 'assistant' response
        case 'message':
          const {
            // id: messageId,
            content: messageContent,
            // role: messageRole,
          } = oItem;

          // pedantic check
          if (!Array.isArray(messageContent)) {
            console.warn('[DEV] AIX: OpenAI-Response-NS unexpected message content type:', { messageContent });
            break;
          }

          // Message
          for (const content of messageContent) {
            const contentType = content.type;
            switch (contentType) {
              case 'output_text':
                pt.appendText(content.text || '');
                break;

              case 'refusal':
                // show in DEV as we don't know how this looks like
                console.log('[DEV] AIX: OpenAI-Response-NS refusal content:', { refusal: content });
                break;

              default:
                const _exhaustiveCheck: never = contentType;
                console.warn('[DEV] AIX: OpenAI-Response-NS unexpected message content type:', contentType);
                break;
            }
          }

          break;

        case 'function_call':
          const {
            id: fcId,
            call_id: fcCallId,
            arguments: fcArguments,
            name: fcName,
          } = oItem;

          // pedantic check (fcId = fcCallId)
          if (fcId !== fcCallId) {
            console.warn('[DEV] AIX: OpenAI-Response-NS unexpected function call ID mismatch:', { fcId, fcCallId });
            break;
          }

          pt.startFunctionCallInvocation(fcCallId, fcName, 'incr_str', fcArguments);
          pt.endMessagePart();
          break;

        default:
          const _exhaustiveCheck: never = oItemType;
          console.warn('[DEV] AIX: OpenAI-Response-NS unexpected output item type:', oItemType);
          break;
      }

    } // .output[]

    // -> Status
    // .status: check for the status
    // if (response.status !== 'completed')
    //   console.warn('[DEV] AIX: OpenAI-Response-NS unexpected response status:', { status: response.status });

  };
}


function _fromOpenAIFinishReason(finish_reason: string | null | undefined) {
  // expected: can be missing or nullified in certain cases - both for the streaming and non-streaming versions
  if (!finish_reason)
    return null;
  switch (finish_reason) {

    // [OpenAI] normal reach of a stop condition
    case 'stop':
    case 'stop_sequence': // [OpenRouter] Anthropic Claude 1
    case 'end_turn': // [OpenRouter] Anthropic Claude 3.5 backend
    case 'COMPLETE': // [OpenRouter] Command R+
    case 'eos': // [OpenRouter] Phind: CodeLlama
      return 'ok';

    // [OpenAI] finished due to requesting tool+ to be called
    case 'tool_calls':
      return 'ok-tool_invocations';

    // [OpenAI] broken due to reaching the max tokens limit
    case 'length':
      return 'out-of-tokens';

    // [OpenAI] broken due to filtering
    case 'content_filter':
      return 'filter-content';
  }

  // Developers: show more finish reasons (not under flag for now, so we can add to the supported set)
  console.log('AIX: OpenAI-dispatch unexpected finish_reason:', finish_reason);
  return null;
}

function _fromResponseUsage(usage: OpenAIWire_API_Responses.ResponseNS['usage'], parserCreationTimestamp: number, timeToFirstEvent: number | undefined) {

  // -> Stats only in some packages
  if (!usage)
    return undefined;

  // Require at least the completion tokens, or issue a DEV warning otherwise
  if (usage.output_tokens === undefined) {
    // Warn, so we may adjust this usage parsing for Non-OpenAI APIs
    console.log('[DEV] AIX: OpenAI-dispatch missing completion tokens in usage', { usage });
    return undefined;
  }

  // Create the metrics update object
  const metricsUpdate: AixWire_Particles.CGSelectMetrics = {
    TIn: usage.input_tokens ?? undefined,
    TOut: usage.output_tokens,
    // dtInner: openAI is not reporting the time as seen by the servers
    dtAll: Date.now() - parserCreationTimestamp,
  };

  // Input Metrics

  // Input redistribution: Cache Read
  if (usage.input_tokens_details) {
    const TCacheRead = usage.input_tokens_details.cached_tokens;
    if (TCacheRead !== undefined && TCacheRead > 0) {
      metricsUpdate.TCacheRead = TCacheRead;
      if (metricsUpdate.TIn !== undefined)
        metricsUpdate.TIn -= TCacheRead;
    }
  }

  // TODO Input redistribution: Audio tokens

  // Output Metrics

  // Output breakdown: Reasoning
  if (usage.output_tokens_details) {
    const details = usage.output_tokens_details || {};
    if (details.reasoning_tokens !== undefined)
      metricsUpdate.TOutR = usage.output_tokens_details.reasoning_tokens;
  }

  // TODO: Output breakdown: Audio

  // Time Metrics

  if (timeToFirstEvent !== undefined)
    metricsUpdate.dtStart = timeToFirstEvent;

  return metricsUpdate;
}

/**
 * If there's an error in the pre-decoded message, push it down to the particle transmitter.
 */
function _forwardResponseError(parsedData: any, pt: IParticleTransmitter) {

  // operate on .error
  if (!parsedData || !parsedData.error) return false;
  const { error } = parsedData;

  // require .message/.code to consider this a valid error object
  if (!(typeof error === 'object') || !('message' in error) || !('code' in error)) {
    console.log('[DEV] AIX: OpenAI-Responses-dispatch ignored error:', { error });
    return false;
  }

  // prepare the text message
  let errorMessage = safeErrorString(error) || 'unknown.';

  // [OpenRouter] we may have a more specific error message inside the 'metadata' field
  if ('metadata' in error && typeof error.metadata === 'object') {
    const { metadata } = error;
    if ('provider_name' in metadata && 'raw' in metadata)
      errorMessage += ` -- cause: ${safeErrorString(metadata.provider_name)} error: ${safeErrorString(metadata.raw)}`;
    else
      errorMessage += ` -- cause: ${safeErrorString(metadata)}`;
  }

  // Transmit the error as text - note: throw if you want to transmit as 'error'
  pt.setDialectTerminatingIssue(errorMessage, IssueSymbols.Generic);
  return true;
}
