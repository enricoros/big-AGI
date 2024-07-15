import { safeErrorString } from '~/server/wire';

import type { ChatGenerateMessageAction, ChatGenerateParseFunction } from '../chatGenerate.types';
import { ISSUE_SYMBOL } from '../chatGenerate.config';
import { OpenAIWire_API_Chat_Completions } from '../../wiretypes/openai.wiretypes';


export function createOpenAIMessageCreateParser(): ChatGenerateParseFunction {
  let hasBegun = false;
  let hasWarned = false;
  // NOTE: could compute rate (tok/s) from the first textful event to the last (to ignore the prefill time)

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

    // -> Stats
    if (json.usage && json.usage.completion_tokens)
      yield { op: 'set', value: { stats: { chatInTokens: json.usage.prompt_tokens || -1, chatOutTokens: json.usage.completion_tokens } } };

    // expect: 1 completion, or stop
    if (json.choices.length !== 1) {

      // Usage objects will likely have an empty completion
      if (json.usage)
        return;

      // [Azure] we seem to get 'prompt_annotations' or 'prompt_filter_results' objects - which we will ignore to suppress the error
      if (json.id === '' && json.object === '' && json.model === '')
        return;

      throw new Error(`expected 1 completion, got ${json.choices.length}`);
    }

    // expect: index=0 (n: 1)
    const index = json.choices[0].index;
    if (index !== 0 && index !== undefined /* [OpenRouter->Gemini] */)
      throw new Error(`expected completion index 0, got ${index}`);

    // -> Text
    const text = json.choices[0].delta?.content /*|| json.choices[0]?.text*/ || '';
    if (text?.length)
      yield { op: 'text', text };

    // Note: not needed anymore - Workaround for implementations that don't send the [DONE] event
    // use the finish_reason to close the parser
    // if (json.choices[0].finish_reason)
    //   return yield { op: 'parser-close' };
  };
}
