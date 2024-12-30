import { safeErrorString } from '~/server/wire';
import { serverSideId } from '~/server/trpc/trpc.nanoid';

import type { AixWire_Particles } from '../../../api/aix.wiretypes';
import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter } from '../IParticleTransmitter';
import { IssueSymbols } from '../ChatGenerateTransmitter';

import { OpenAIWire_API_Chat_Completions } from '../../wiretypes/openai.wiretypes';


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
    // ```Can you extend the Zod chunk response object parsing (all optional) to include the missing data? The following is an exampel of the object I received:```
    const chunkData = JSON.parse(eventData); // this is here just for ease of breakpoint, otherwise it could be inlined

    // [OpenRouter] transmits upstream errors pre-parsing (object wouldn't be valid)
    if (_forwardOpenRouterDataError(chunkData, pt))
      return;

    const json = OpenAIWire_API_Chat_Completions.ChunkResponse_schema.parse(chunkData);

    // -> Model
    if (!hasBegun && json.model) {
      hasBegun = true;
      pt.setModelName(json.model);
    }

    // [OpenAI] an upstream error will be handled gracefully and transmitted as text (throw to transmit as 'error')
    if (json.error) {
      return pt.setDialectTerminatingIssue(safeErrorString(json.error) || 'unknown.', IssueSymbols.Generic);
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

    for (const { index, delta, finish_reason } of json.choices) {

      // n=1 -> single Choice only
      if (index !== 0 && index !== undefined /* [OpenRouter->Gemini] */)
        throw new Error(`expected completion index 0, got ${index}`);

      // handle missing content
      if (!delta)
        throw new Error(`server response missing content (finish_reason: ${finish_reason})`);

      // delta: Text
      if (typeof delta.content === 'string') {

        accumulator.content = (accumulator.content || '') + delta.content;
        pt.appendText(delta.content);

      } else if (delta.content !== undefined && delta.content !== null)
        throw new Error(`unexpected delta content type: ${typeof delta.content}`);

      // delta: Tool Calls
      for (const deltaToolCall of (delta.tool_calls || [])) {

        // validation
        if (deltaToolCall.type !== undefined && deltaToolCall.type !== 'function')
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

  return function(pt: IParticleTransmitter, eventData: string) {

    // Throws on malformed event data
    const completeData = JSON.parse(eventData);

    // [OpenRouter] transmits upstream errors pre-parsing (object wouldn't be valid)
    if (_forwardOpenRouterDataError(completeData, pt))
      return;

    // [OpenAI] we don't know yet if warning messages are sent in non-streaming - for now we log
    if (completeData.warning)
      console.log('AIX: OpenAI-dispatch-NS warning:', completeData.warning);

    // Parse the complete response
    const json = OpenAIWire_API_Chat_Completions.Response_schema.parse(completeData);

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
        if (message.content)
          pt.appendText(message.content);
      } else if (message.content !== undefined && message.content !== null)
        throw new Error(`unexpected message content type: ${typeof message.content}`);

      // message: Tool Calls
      for (const toolCall of (message.tool_calls || [])) {

        // [Mistral] we had to relax the parser to miss type: 'function', as Mistral does not generate it
        // Note that we relaxed the
        const mayBeMistral = toolCall.type === undefined;

        if (toolCall.type !== 'function' && !mayBeMistral)
          throw new Error(`unexpected tool_call type: ${toolCall.type}`);
        pt.startFunctionCallInvocation(toolCall.id, toolCall.function.name, 'incr_str', toolCall.function.arguments);
        pt.endMessagePart();
      } // .choices.tool_calls[]

      // Token Stop Reason - expected to be set
      const tokenStopReason = _fromOpenAIFinishReason(finish_reason);
      if (tokenStopReason !== null)
        pt.setTokenStopReason(tokenStopReason);

    } // .choices[]

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
  if (usage.prompt_tokens_details !== undefined) {
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
  if (usage.completion_tokens_details?.reasoning_tokens !== undefined)
    metricsUpdate.TOutR = usage.completion_tokens_details.reasoning_tokens;

  // TODO: Output breakdown: Audio

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
  pt.setDialectTerminatingIssue(errorMessage, IssueSymbols.Generic);
  return true;
}