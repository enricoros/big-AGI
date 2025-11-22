import { safeErrorString } from '~/server/wire';
import { serverSideId } from '~/server/trpc/trpc.nanoid';

import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter } from './IParticleTransmitter';
import { IssueSymbols } from '../ChatGenerateTransmitter';

import { OpenAIWire_API_Chat_Completions } from '../../wiretypes/openai.wiretypes';
import { calculateDurationMs, createWAVFromPCM } from './gemini.audioutils';


/**
 * OpenAI Streaming Completions -  Messages Architecture
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
export function createOpenAIChatCompletionsChunkParser(): ChatGenerateParseFunction {
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
    audio: null | {
      id: string | null;
      data: string; // accumulated base64 audio data
      transcript: string;
    };
  } = {
    content: null,
    tool_calls: [],
    audio: null,
  };

  return function(pt: IParticleTransmitter, eventData: string) {

    // Time to first event
    if (timeToFirstEvent === undefined)
      timeToFirstEvent = Date.now() - parserCreationTimestamp;

    // Throws on malformed event data
    // ```Can you extend the Zod chunk response object parsing (all optional) to include the missing data? The following is an exampel of the object I received:```
    const chunkData = JSON.parse(eventData); // this is here just for ease of breakpoint, otherwise it could be inlined

    // [OpenRouter/others] transmits upstream errors pre-parsing (object wouldn't be valid)
    if (_forwardOpenRouterDataError(chunkData, pt))
      return;

    // [OpenAI] Obfuscation message with no data -> skip
    if (!chunkData?.['choices'] && chunkData?.['obfuscation']) {
      // NOTE: these sort of messages have no useful data and would break the parser here
      // console.log('AIX: OpenAI-dispatch: missing-choices chunk skipped', chunkData);
      return;
    }

    const json = OpenAIWire_API_Chat_Completions.ChunkResponse_schema.parse(chunkData);

    // -> Model
    if (!hasBegun && json.model) {
      hasBegun = true;
      pt.setModelName(json.model);
    }

    // [OpenAI] an upstream error will be handled gracefully and transmitted as text (throw to transmit as 'error')
    if (json.error) {
      // FIXME: potential point for throwing RequestRetryError (using 'srv-warn' for now)
      return pt.setDialectTerminatingIssue(safeErrorString(json.error) || 'unknown.', IssueSymbols.Generic, 'srv-warn');
    }

    // [OpenAI] if there's a warning, log it once
    if (json.warning && !hasWarned) {
      hasWarned = true;
      console.log('AIX: OpenAI-dispatch chunk warning:', json.warning);
    }

    // [Azure] we seem to get 'prompt_annotations' or 'prompt_filter_results' objects - which we will ignore to suppress the error
    if (json.id === '' && json.object === '' && json.model === '')
      return;


    // -> Stats
    if (json.usage) {
      const metrics = _fromOpenAIUsage(json.usage, parserCreationTimestamp, timeToFirstEvent);
      if (metrics)
        pt.updateMetrics(metrics);
      // [OpenAI] Expected correct case: the last object has usage, but an empty choices array
      if (!json.choices.length)
        return;
    }
    // [Groq] -> Stats
    // Note: if still in queue, reset the event stats, until we're out of the queue
    if (json.x_groq?.queue_length)
      timeToFirstEvent = undefined;
    if (json.x_groq?.usage) {
      const { prompt_tokens, completion_tokens, completion_time } = json.x_groq.usage;
      const metricsUpdate: AixWire_Particles.CGSelectMetrics = {
        TIn: prompt_tokens,
        TOut: completion_tokens,
        vTOutInner: (completion_tokens && completion_time) ? Math.round((completion_tokens / completion_time) * 100) / 100 : undefined,
        dtInner: Math.round((completion_time || 0) * 1000),
        dtAll: Date.now() - parserCreationTimestamp,
      };
      if (timeToFirstEvent !== undefined)
        metricsUpdate.dtStart = timeToFirstEvent;
      pt.updateMetrics(metricsUpdate);
    }

    // expect: 1 completion, or stop
    if (json.choices.length !== 1)
      throw new Error(`expected 1 completion, got ${json.choices.length}`);


    // [Perplexity] .search_results
    if (json.search_results && Array.isArray(json.search_results)) {

      // Process only new search results
      for (const searchResult of json.search_results) {

        // Incremental processing
        const url = searchResult?.url;
        if (!url || processedSearchResultUrls.has(url))
          continue;
        processedSearchResultUrls.add(url);

        // Append the new citation
        let pubTs: number | undefined;
        if (searchResult.date) {
          const date = new Date(searchResult.date);
          if (!isNaN(date.getTime()))
            pubTs = date.getTime();
        }
        pt.appendUrlCitation(searchResult.title || '', url, progressiveCitationNumber++, undefined, undefined, undefined, pubTs);
      }

    }
    // [Perplexity] .citations (DEPRECATED)
    // if (json.citations && !perplexityAlreadyCited && Array.isArray(json.citations)) {
    //
    //   for (const citationUrl of json.citations)
    //     if (typeof citationUrl === 'string')
    //       pt.appendUrlCitation('', citationUrl, progressiveCitationNumber++, undefined, undefined, undefined);
    //
    //   // Perplexity detection: streaming of full objects, hence we don't re-send the citations at every chunk
    //   if (json.object === 'chat.completion')
    //     perplexityAlreadyCited = true;
    //
    // }


    for (const { index, delta, finish_reason } of json.choices) {

      // n=1 -> single Choice only
      if (index !== 0 && index !== undefined /* [OpenRouter->Gemini] */)
        throw new Error(`expected completion index 0, got ${index}`);

      // handle missing content
      if (!delta)
        throw new Error(`server response missing content (finish_reason: ${finish_reason})`);

      // delta: Reasoning Content [Deepseek, 2025-01-20]
      let deltaHasReasoning = false;
      if (typeof delta.reasoning_content === 'string') {

        pt.appendReasoningText(delta.reasoning_content);
        deltaHasReasoning = true;

      }
      // delta: Reasoning Details (Structured) [OpenRouter, 2025-11-11]
      else if (Array.isArray(delta.reasoning_details)) {

        for (const reasoningDetail of delta.reasoning_details) {
          // Extract text from reasoning blocks based on type
          if (reasoningDetail.type === 'reasoning.text' && typeof reasoningDetail.text === 'string') {
            pt.appendReasoningText(reasoningDetail.text);
            deltaHasReasoning = true;
          }
          // Summaries can also be shown as reasoning
          else if (reasoningDetail.type === 'reasoning.summary' && typeof reasoningDetail.summary === 'string') {
            // pt.appendReasoningText(`[Summary] ${reasoningDetail.summary}`);
            pt.appendReasoningText(reasoningDetail.summary);
            deltaHasReasoning = true;
          }
          // 'encrypted' type - reasoning happened but not returned, skip
          else if (reasoningDetail.type === 'reasoning.encrypted') {
            // NOTE: Anthropic supports this, and we do too, but.. not now
            // reasoning happened but not returned, skip
          } else
            console.log('AIX: OpenAI-dispatch: unexpected reasoning detail type:', reasoningDetail);
        }

      }

      // delta: Text
      if (typeof delta.content === 'string' &&
        (!deltaHasReasoning || delta.content) // suppress if reasoning and empty
      ) {

        accumulator.content = (accumulator.content || '') + delta.content;
        pt.appendAutoText_weak(delta.content);

      }

      // [Mistral, 2025-10-15] SPEC-VIOLATION Text (array format from Mistral thinking models)
      else if (Array.isArray(delta.content)) {
        for (const contentBlock of delta.content)
          if (contentBlock.type === 'thinking' && Array.isArray(contentBlock.thinking)) {
            // Extract text from thinking blocks and send as reasoning
            for (const thinkingPart of contentBlock.thinking)
              if (thinkingPart.type === 'text' && typeof (thinkingPart.text as unknown) === 'string') {
                pt.appendReasoningText(thinkingPart.text);
                deltaHasReasoning = true;
              } else {
                // Handle other thinking part types if necessary
                console.log('AIX: OpenAI-dispatch: unexpected thinking part type from Mistral:', thinkingPart);
              }
          } else {
            // Handle other content types if necessary
            console.log('AIX: OpenAI-dispatch: unexpected content block type from Mistral:', contentBlock);
          }
      }

      // 2025-03-26: we don't have the full concurrency combinations of content/reasoning/reasoning_content yet
      // if (delta.content !== undefined && delta.content !== null)
      //   throw new Error(`unexpected delta content type: ${typeof delta.content}`);

      // delta: Tool Calls
      for (const deltaToolCall of (delta.tool_calls || [])) {

        // validation
        if (deltaToolCall.type !== undefined && deltaToolCall.type !== 'function'
          && deltaToolCall.type !== 'builtin_function' // [Moonshot, 2025-11-09] Support Moonshot-over-OpenAI builtin tools
        )
          throw new Error(`unexpected tool_call type: ${deltaToolCall.type}`);

        // Creation -  Ensure the tool call exists in our accumulated structure
        const tcIndex = deltaToolCall.index ?? accumulator.tool_calls.length;
        if (!accumulator.tool_calls[tcIndex]) {
          const created = accumulator.tool_calls[tcIndex] = {
            id: deltaToolCall.id || serverSideId('aix-tool-call-id'),
            type: 'function',
            function: {
              name: deltaToolCall.function.name || '',
              arguments: deltaToolCall.function.arguments || '',
            },
          };
          pt.startFunctionCallInvocation(created.id, created.function.name, 'incr_str', created.function.arguments);
          break;
        }

        // Updating arguments
        const accumulatedToolCall = accumulator.tool_calls[tcIndex];

        // Validate
        if (deltaToolCall.id && deltaToolCall.id !== accumulatedToolCall.id)
          throw new Error(`unexpected tool_call id change: ${deltaToolCall.id}`);
        if (deltaToolCall.function.name)
          throw new Error(`unexpected tool_call name change: ${deltaToolCall.function.name}`);

        // It's an arguments update - send it
        if (deltaToolCall.function?.arguments) {
          accumulatedToolCall.function.arguments += deltaToolCall.function.arguments;
          pt.appendFunctionCallInvocationArgs(accumulatedToolCall.id, deltaToolCall.function.arguments);
        }

      } // .choices.tool_calls[]

      // [OpenAI, 2025-03-11] delta: Annotations[].url_citation
      if (delta.annotations !== undefined) {

        if (Array.isArray(delta.annotations)) {
          for (const { type: annotationType, url_citation: urlCitation } of delta.annotations) {
            if (annotationType !== 'url_citation')
              throw new Error(`unexpected annotation type: ${annotationType}`);
            pt.appendUrlCitation(urlCitation.title, urlCitation.url, undefined, urlCitation.start_index, urlCitation.end_index, undefined, undefined);
          }
        } else {
          // we don't abort for this issue - for our users
          console.log('AIX: OpenAI-dispatch: unexpected annotations:', delta.annotations);
        }

      }

      // [OpenAI, 2024-10-17] delta: Audio (streaming)
      if (delta.audio) {

        // NOTE: this is a bit convoluted because the presence/absence of fields indicates 'begin/middle/end'
        if (delta.audio.id && !delta.audio.data) {
          // First chunk: id + maybe data
          if (accumulator.audio?.data.length)
            console.warn('[OpenAI] Starting new audio stream while previous stream has data');
          accumulator.audio = {
            id: delta.audio.id,
            data: delta.audio.data || '',
            transcript: '',
          };
        }

        // Middle chunks
        if (accumulator.audio) {
          const acc = accumulator.audio;
          if (delta.audio.data) acc.data += delta.audio.data;
          if (delta.audio.transcript) acc.transcript += delta.audio.transcript;

          // Ending chunk
          if (delta.audio.expires_at) {
            if (acc.data?.length) {
              try {
                // OpenAI sends PCM16 audio data that needs to be converted to WAV
                const a = openaiConvertPCM16ToWAV(acc.data);
                pt.appendAudioInline(a.mimeType, a.base64Data, acc.transcript || 'OpenAI Generated Audio', `OpenAI ${json.model || ''}`.trim(), a.durationMs);
              } catch (error) {
                console.warn('[OpenAI] Failed to process streaming audio:', error);
                pt.setDialectTerminatingIssue(`Failed to process audio: ${error}`, null, 'srv-warn');
              }
            } else
              console.warn('[OpenAI] Ignoring audio expires_at without a valid audio stream');

          }
        }
      }

      // Token Stop Reason - usually missing in all but the last chunk, but we don't rely on it
      if (finish_reason) {
        const tokenStopReason = _fromOpenAIFinishReason(finish_reason);
        if (tokenStopReason !== null)
          pt.setTokenStopReason(tokenStopReason);
      }

      // Note: not needed anymore - Workaround for implementations that don't send the [DONE] event
      // if (finish_reason === 'max_tokens')
      //   pt.setDialectTerminatingIssue('finish-reason');

    } // .choices[]

  };
}


/// OpenAI non-streaming ChatCompletions

export function createOpenAIChatCompletionsParserNS(): ChatGenerateParseFunction {
  const parserCreationTimestamp = Date.now();
  let progressiveCitationNumber = 1;

  return function(pt: IParticleTransmitter, eventData: string) {

    // Throws on malformed event data
    const completeData = JSON.parse(eventData);

    // [OpenRouter/others] transmits upstream errors pre-parsing (object wouldn't be valid)
    if (_forwardOpenRouterDataError(completeData, pt))
      return;

    // [OpenAI] we don't know yet if warning messages are sent in non-streaming - for now we log
    if (completeData.warning)
      console.log('AIX: OpenAI-dispatch-NS warning:', completeData.warning);

    // Parse the complete response

    // [Fixup, 2025-11-11] Some OpenAI-compatible APIs omit the 'object' field - inject it if needed
    let json: OpenAIWire_API_Chat_Completions.Response;
    const parseResult = OpenAIWire_API_Chat_Completions.Response_schema.safeParse(completeData);
    if (!parseResult.success) {
      // Attempt recovery by injecting missing 'object' field
      const recoveredData = { object: 'chat.completion', ...completeData };
      json = OpenAIWire_API_Chat_Completions.Response_schema.parse(recoveredData);
    } else
      json = parseResult.data;

    // -> Model
    if (json.model)
      pt.setModelName(json.model);

    // -> Stats
    if (json.usage) {
      const metrics = _fromOpenAIUsage(json.usage, parserCreationTimestamp, undefined);
      if (metrics)
        pt.updateMetrics(metrics);
    }

    // Assumption/validate: expect 1 completion, or stop
    if (json.choices.length !== 1)
      throw new Error(`expected 1 completion, got ${json.choices.length}`);

    for (const { index, message, finish_reason } of json.choices) {

      // n=1 -> single Choice only
      if (index !== 0)
        throw new Error(`expected completion index 0, got ${index}`);

      // handle missing content
      if (!message)
        throw new Error(`server response missing content (finish_reason: ${finish_reason})`);

      // message: Text
      if (typeof message.content === 'string') {
        if (message.content) {
          // we will return the EXACT content for non-streaming calls, hence we don't call `appendAutoText_weak` here
          pt.appendText(message.content);
        }
      }
      // [Mistral, 2025-10-15] SPEC-VIOLATION Text (array format from Mistral thinking models - non-streaming)
      else if (Array.isArray(message.content)) {
        for (const contentBlock of message.content) {
          // handle thinking blocks
          if (contentBlock.type === 'thinking' && Array.isArray(contentBlock.thinking)) {
            for (const thinkingPart of contentBlock.thinking) {
              if (thinkingPart.type === 'text' && typeof (thinkingPart.text as unknown) === 'string')
                pt.appendReasoningText(thinkingPart.text);
              else
                console.warn('AIX: OpenAI-dispatch-NS: unexpected thinking part type:', thinkingPart); // back to the future
            }
          }
          // text blocks
          else if (contentBlock.type === 'text' && typeof contentBlock.text === 'string')
            pt.appendText(contentBlock.text);
          else
            console.warn('AIX: OpenAI-dispatch-NS: unexpected content block type:', contentBlock); // back to the future
        }
      } else if (message.content !== undefined && message.content !== null)
        throw new Error(`unexpected message content type: ${typeof message.content}`);

      // [OpenRouter, 2025-11-11] Handle structured reasoning_details
      if (Array.isArray(message.reasoning_details)) {
        for (const reasoningDetail of message.reasoning_details) {
          if (reasoningDetail.type === 'reasoning.text' && typeof reasoningDetail.text === 'string') {
            pt.appendReasoningText(reasoningDetail.text);
          } else if (reasoningDetail.type === 'reasoning.summary' && typeof reasoningDetail.summary === 'string') {
            // pt.appendReasoningText(`[Summary] ${reasoningDetail.summary}`);
            pt.appendReasoningText(reasoningDetail.summary);
          } else if (reasoningDetail.type === 'reasoning.encrypted') {
            // reasoning happened but not returned, skip
          } else
            console.log('AIX: OpenAI-dispatch-NS: unexpected reasoning detail type:', reasoningDetail);
        }
      }

      // message: Tool Calls
      for (const toolCall of (message.tool_calls || [])) {

        // [Mistral] we had to relax the parser to miss type: 'function', as Mistral does not generate it
        // Note that we relaxed the
        const mayBeMistral = toolCall.type === undefined;

        if (toolCall.type !== 'function' && !mayBeMistral
          && toolCall.type !== 'builtin_function' // [Moonshot, 2025-11-09] Support Moonshot-over-OpenAI builtin tools
        )
          throw new Error(`unexpected tool_call type: ${toolCall.type}`);
        pt.startFunctionCallInvocation(toolCall.id, toolCall.function.name, 'incr_str', toolCall.function.arguments);
        pt.endMessagePart();
      } // .choices.tool_calls[]

      // Token Stop Reason - expected to be set
      const tokenStopReason = _fromOpenAIFinishReason(finish_reason);
      if (tokenStopReason !== null)
        pt.setTokenStopReason(tokenStopReason);

      // [OpenAI, 2025-03-11] message: Annotations[].url_citation
      if (message.annotations !== undefined) {

        if (Array.isArray(message.annotations)) {
          for (const { type: annotationType, url_citation: urlCitation } of message.annotations) {
            if (annotationType !== 'url_citation')
              throw new Error(`unexpected annotation type: ${annotationType}`);
            pt.appendUrlCitation(urlCitation.title, urlCitation.url, undefined, urlCitation.start_index, urlCitation.end_index, undefined, undefined);
          }
        } else {
          // we don't abort for this issue
          console.log('AIX: OpenAI-dispatch-NS unexpected annotations:', message.annotations);
        }

      }

      // [OpenAI, 2024-10-17] message: Audio output (non-streaming only)
      if (message.audio && typeof message.audio === 'object' && 'data' in message.audio) {
        try {
          // OpenAI sends PCM16 audio data that needs to be converted to WAV
          const a = openaiConvertPCM16ToWAV(message.audio.data);
          pt.appendAudioInline(a.mimeType, a.base64Data, message.audio.transcript || 'OpenAI Generated Audio', `OpenAI ${json.model || ''}`.trim(), a.durationMs);
        } catch (error) {
          console.warn('[OpenAI] Failed to process audio:', error);
          pt.setDialectTerminatingIssue(`Failed to process audio: ${error}`, null, 'srv-warn');
        }
      }

    } // .choices[]

    // [Perplexity] .search_results
    if (json.search_results && Array.isArray(json.search_results)) {

      for (const searchResult of json.search_results) {
        const url = searchResult?.url;
        if (url) {
          // Append the new citation
          let pubTs: number | undefined;
          if (searchResult.date) {
            const date = new Date(searchResult.date);
            if (!isNaN(date.getTime()))
              pubTs = date.getTime();
          }
          pt.appendUrlCitation(searchResult.title || '', url, progressiveCitationNumber++, undefined, undefined, undefined, pubTs);
        }
      }

    }
    // [Perplexity] .citations (DEPRECATED)
    // if (json.citations && Array.isArray(json.citations)) {
    //
    //   for (const citationUrl of json.citations)
    //     if (typeof citationUrl === 'string')
    //       pt.appendUrlCitation('', citationUrl, progressiveCitationNumber++, undefined, undefined, undefined);
    //
    // }

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

function _fromOpenAIUsage(usage: OpenAIWire_API_Chat_Completions.Response['usage'], parserCreationTimestamp: number, timeToFirstEvent: number | undefined) {

  // -> Stats only in some packages
  if (!usage)
    return undefined;

  // Require at least the completion tokens, or issue a DEV warning otherwise
  if (usage.completion_tokens === undefined) {
    // Warn, so we may adjust this usage parsing for Non-OpenAI APIs
    console.log('[DEV] AIX: OpenAI-dispatch missing completion tokens in usage', { usage });
    return undefined;
  }

  // Create the metrics update object
  const metricsUpdate: AixWire_Particles.CGSelectMetrics = {
    TIn: usage.prompt_tokens ?? undefined,
    TOut: usage.completion_tokens,
    // dtInner: openAI is not reporting the time as seen by the servers
    dtAll: Date.now() - parserCreationTimestamp,
  };

  // Input Metrics

  // Input redistribution: Cache Read
  if (usage.prompt_tokens_details) {
    const TCacheRead = usage.prompt_tokens_details.cached_tokens;
    if (TCacheRead !== undefined && TCacheRead > 0) {
      metricsUpdate.TCacheRead = TCacheRead;
      if (metricsUpdate.TIn !== undefined)
        metricsUpdate.TIn -= TCacheRead;
    }
  }

  // [DeepSeek] Input redistribution: Cache Read
  if (usage.prompt_cache_hit_tokens !== undefined) {
    const TCacheRead = usage.prompt_cache_hit_tokens;
    if (TCacheRead > 0) {
      metricsUpdate.TCacheRead = TCacheRead;
      if (usage.prompt_cache_miss_tokens !== undefined)
        metricsUpdate.TIn = usage.prompt_cache_miss_tokens;
    }
  }

  // TODO Input redistribution: Audio tokens

  // Output Metrics

  // Output breakdown: Reasoning
  if (usage.completion_tokens_details) {
    const details = usage.completion_tokens_details || {};
    if (details.reasoning_tokens !== undefined)
      metricsUpdate.TOutR = usage.completion_tokens_details.reasoning_tokens;
  }

  // TODO: Output breakdown: Audio

  // Upstream Cost Reporting

  // [Perplexity, 2025-10-20] - cost as object with total_cost
  // [OpenRouter, 2025-10-22] - cost as direct number
  if (usage.cost !== null && usage.cost !== undefined) {
    if (typeof usage.cost === 'number') {
      // OpenRouter sends cost directly as a number
      metricsUpdate.$cReported = Math.round(usage.cost * 100 * 10000) / 10000;
    } else if (typeof usage.cost === 'object' && 'total_cost' in usage.cost && typeof usage.cost.total_cost === 'number') {
      // Perplexity sends cost as an object with total_cost
      metricsUpdate.$cReported = Math.round(usage.cost.total_cost * 100 * 10000) / 10000;
    }
  }

  // Time Metrics

  if (timeToFirstEvent !== undefined)
    metricsUpdate.dtStart = timeToFirstEvent;

  return metricsUpdate;
}

/**
 * If there's an error in the pre-decoded message, push it down to the particle transmitter.
 */
function _forwardOpenRouterDataError(parsedData: any, pt: IParticleTransmitter) {

  // operate on .error
  if (!parsedData || !parsedData.error) return false;
  const { error } = parsedData;

  // require .message/.code to consider this a valid error object
  if (!(typeof error === 'object') || !('message' in error) || !('code' in error)) {
    console.log('AIX: OpenAI-dispatch ignored error:', { error });
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
  // FIXME: potential point for throwing RequestRetryError (using 'srv-warn' for now)
  pt.setDialectTerminatingIssue(errorMessage, IssueSymbols.Generic, 'srv-warn');
  return true;
}


/** Convert OpenAI PCM16 audio to WAV format - 24kHz sample rate, 1 channel (mono), 16 bits per sample */
function openaiConvertPCM16ToWAV(base64PCMData: string): {
  mimeType: string;
  base64Data: string;
  durationMs: number;
} {
  // OpenAI 'pcm16' audio format: PCM16, 24kHz, mono
  const format = {
    sampleRate: 24000,
    channels: 1,
    bitsPerSample: 16,
  };

  const pcmBuffer = Buffer.from(base64PCMData, 'base64');

  const wavBuffer = createWAVFromPCM(pcmBuffer, format);
  const durationMs = calculateDurationMs(pcmBuffer.length, format);

  return {
    mimeType: 'audio/wav',
    base64Data: wavBuffer.toString('base64'),
    durationMs,
  };
}
