/*
import type { ChatGenerateMessageAction, ChatGenerateParseFunction } from '~/modules/aix/server/dispatch/chatGenerate/chatGenerate.types';
import { wireOllamaChunkedOutputSchema } from '~/modules/aix/server/dispatch/wiretypes/ollama.wiretypes';
import { ISSUE_SYMBOL } from '~/modules/aix/server/dispatch/chatGenerate/chatGenerate.config';

export function createOllamaParser(): ChatGenerateParseFunction {
  let hasBegun = false;

  return function* (eventData: string): Generator<ChatGenerateMessageAction> {

    // parse the JSON chunk
    let wireJsonChunk: any;
    try {
      wireJsonChunk = JSON.parse(eventData);
    } catch (error: any) {
      // log the malformed data to the console, and rethrow to transmit as 'error'
      console.log(`/api/llms/stream: Ollama parsing issue: ${error?.message || error}`, eventData);
      throw error;
    }

    // validate chunk
    const chunk = wireOllamaChunkedOutputSchema.parse(wireJsonChunk);

    // pass through errors from Ollama
    if ('error' in chunk) {
      yield { op: 'issue', issue: `Error: ${chunk.error}`, symbol: ISSUE_SYMBOL };
      return yield { op: 'parser-close' };
    }

    // -> Model
    if (!hasBegun && chunk.model) {
      hasBegun = true;
      yield { op: 'set', value: { model: chunk.model } };
    }

    // -> Text
    let text = chunk.message?.content || ''; // || chunk.response
    yield { op: 'text', text };

    if (chunk.eval_count && chunk.eval_duration) {
      const chatOutTokens = chunk.eval_count;
      const chatOutTime = chunk.eval_duration / 1E+09;
      const chatOutRate = Math.round(100 * (chatOutTime > 0 ? chatOutTokens / chatOutTime : 0)) / 100;
      yield { op: 'set', value: { stats: { chatInTokens: chunk.prompt_eval_count || -1, chatOutTokens, chatOutRate } } };
    }

    if (chunk.done)
      yield { op: 'parser-close' };
  };
}
*/