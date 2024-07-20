import { safeErrorString } from '~/server/wire';
import { serverSideId } from '~/server/api/trpc.nanoid';

import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import { IssueSymbols, PartTransmitter } from '../../../api/PartTransmitter';

import { OpenAIWire_API_Chat_Completions } from '../../wiretypes/openai.wiretypes';


/// OpenAI streaming ChatCompletions

export function createOpenAIChatCompletionsChunkParser(): ChatGenerateParseFunction {
  let hasBegun = false;
  let hasWarned = false;
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

  return function(pt: PartTransmitter, eventData: string) {

    // Throws on malformed event data
    const json = OpenAIWire_API_Chat_Completions.ChunkResponse_schema.parse(JSON.parse(eventData));

    // -> Model
    if (!hasBegun && json.model) {
      hasBegun = true;
      pt.setModelName(json.model);
    }

    // [OpenAI] an upstream error will be handled gracefully and transmitted as text (throw to transmit as 'error')
    if (json.error) {
      return pt.terminatingDialectIssue(safeErrorString(json.error) || 'unknown.', IssueSymbols.Generic);
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
      if (json.usage.completion_tokens !== undefined)
        pt.setCounters({ chatIn: json.usage.prompt_tokens || -1, chatOut: json.usage.completion_tokens });

      // [OpenAI] Expected correct case: the last object has usage, but an empty choices array
      if (!json.choices.length)
        return;
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
          pt.startFunctionToolCall(created.id, created.function.name, 'incr_str', created.function.arguments);
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
          pt.appendFunctionToolCallArgsIStr(accumulatedToolCall.id, deltaToolCall.function.arguments);
        }

      } // .choices.tool_calls[]

      // Finish reason: we don't really need it
      // Empirically, different dialects will have different reasons for stopping
      // if (finish_reason)
      //   pt.setFinishReason(... some mapping ...);
      // Note: not needed anymore - Workaround for implementations that don't send the [DONE] event
      // if (finish_reason === 'max_tokens')
      //   pt.terminateParser('finish-reason');

    } // .choices[]

  };
}


/// OpenAI non-streaming ChatCompletions

export function createOpenAIChatCompletionsParserNS(): ChatGenerateParseFunction {

  return function(pt: PartTransmitter, eventData: string) {

    // Throws on malformed event data
    const json = OpenAIWire_API_Chat_Completions.Response_schema.parse(JSON.parse(eventData));

    // [OpenAI] we don't know if error messages are sent in the non-streaming version - for now we log
    if (json.error)
      console.log('AIX: OpenAI-dispatch-NS error:', json.error);
    if (json.warning)
      console.log('AIX: OpenAI-dispatch-NS warning:', json.warning);

    // -> Model
    if (json.model)
      pt.setModelName(json.model);

    // -> Stats
    if (json.usage)
      pt.setCounters({ chatIn: json.usage.prompt_tokens, chatOut: json.usage.completion_tokens, chatTotal: json.usage.total_tokens });

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
        pt.startFunctionToolCall(toolCall.id, toolCall.function.name, 'incr_str', toolCall.function.arguments);
        pt.endPart();
      } // .choices.tool_calls[]

      // Finish reason: we don't really need it
      // ...

    } // .choices[]

  };
}
