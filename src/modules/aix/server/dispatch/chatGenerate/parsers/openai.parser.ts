import { safeErrorString } from '~/server/wire';

import type { ChatGenerateMessageAction, ChatGenerateParseFunction } from '../chatGenerate.types';
import { ISSUE_SYMBOL } from '../chatGenerate.config';
import { OpenAIWire_API_Chat_Completions } from '../../wiretypes/openai.wiretypes';


export function createOpenAIMessageCreateParser(): ChatGenerateParseFunction {
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
        arguments: string;
      };
    }[];
  } = {
    content: null,
    tool_calls: [],
  };


  return function* (eventData: string): Generator<ChatGenerateMessageAction> {

    // Throws on malformed event data
    const json = OpenAIWire_API_Chat_Completions.ChunkResponse_schema.parse(JSON.parse(eventData));

    // -> Model
    if (!hasBegun && json.model) {
      hasBegun = true;
      yield { op: 'set', value: { model: json.model } };
    }

    // [OpenAI] an upstream error will be handled gracefully and transmitted as text (throw to transmit as 'error')
    if (json.error) {
      yield { op: 'issue', issue: safeErrorString(json.error) || 'unknown.', symbol: ISSUE_SYMBOL };
      return yield { op: 'parser-close' };
    }

    // [OpenAI] if there's a warning, log it once
    if (json.warning && !hasWarned) {
      hasWarned = true;
      console.log('/api/llms/stream: OpenAI dispatch warning:', json.warning);
    }

    // [Azure] we seem to get 'prompt_annotations' or 'prompt_filter_results' objects - which we will ignore to suppress the error
    if (json.id === '' && json.object === '' && json.model === '')
      return;


    // -> Stats
    if (json.usage) {
      if (json.usage.completion_tokens !== undefined)
        yield { op: 'set', value: { stats: { chatInTokens: json.usage.prompt_tokens || -1, chatOutTokens: json.usage.completion_tokens } } };

      // [OpenAI] Expected: the last object has usage, but an empty choices array
      if (!json.choices.length)
        return;
    }

    // expect: 1 completion, or stop
    if (json.choices.length !== 1)
      throw new Error(`expected 1 completion, got ${json.choices.length}`);

    for (const choice of json.choices) {

      const { index, delta, finish_reason } = choice;

      // n=1 -> single Choice only
      if (index !== 0 && index !== undefined /* [OpenRouter->Gemini] */)
        throw new Error(`expected completion index 0, got ${choice.index}`);

      // handle missing content
      if (!delta)
        throw new Error(`server response missing content (finish_reason: ${finish_reason})`);

      // delta: Text
      if (typeof delta.content === 'string') {

        const text = delta.content;
        accumulator.content = (accumulator.content || '') + text;
        yield { op: 'text', text };

      }

      // delta: Tool Calls
      if (delta.tool_calls?.length) {
        for (const deltaToolCall of delta.tool_calls) {

          // validation
          if (deltaToolCall.type !== undefined && deltaToolCall.type !== 'function')
            throw new Error(`unexpected tool_call type: ${deltaToolCall.type}`);

          // Ensure the tool call exists in our accumulated structure
          const tcIndex = deltaToolCall.index ?? accumulator.tool_calls.length;
          let created = false;
          if (!accumulator.tool_calls[tcIndex]) {
            accumulator.tool_calls[tcIndex] = {
              id: deltaToolCall.id || '',
              type: 'function',
              function: { name: deltaToolCall.function.name || '', arguments: '' },
            };
            created = true;
          }
          const accumulatedToolCall = accumulator.tool_calls[tcIndex];

          if (!created) {
            if (deltaToolCall.id && deltaToolCall.id !== accumulatedToolCall.id)
              throw new Error(`unexpected tool_call id: ${deltaToolCall.id}`);
            if (deltaToolCall.function.name)
              throw new Error(`unexpected tool_call function name: ${deltaToolCall.function.name}`);
          }

          // Update the accumulated tool call
          // if (deltaToolCall.id)
          //   accumulatedToolCall.id = deltaToolCall.id;
          // if (deltaToolCall.function?.name)
          //   accumulatedToolCall.function.name +=;
          if (deltaToolCall.function?.arguments)
            accumulatedToolCall.function.arguments += deltaToolCall.function.arguments;

          // assume it's a function, we have the index, and we may have an id for this tool call
          console.log('atc', JSON.stringify(accumulator, null, 2));
        }
      }
    }

    // Note: not needed anymore - Workaround for implementations that don't send the [DONE] event
    // use the finish_reason to close the parser
    // if (json.choices[0].finish_reason)
    //   return yield { op: 'parser-close' };

  };
}
