import { encoding_for_model, get_encoding, Tiktoken, TiktokenModel } from '@dqbd/tiktoken';

import { DLLMId } from '~/modules/llms/llm.types';
import { defaultLLMId, findOpenAILlmIdOrThrow } from '~/modules/llms/llm.store';

import { DMessage } from '../state/store-chats';


// Do not set this to true in production, it's very verbose
const DEBUG_TOKEN_COUNT = false;


/**
 * Wrapper around the Tiktoken library, to keep tokenizers for all models in a cache
 *
 * We also preload the tokenizer for the default model, so that the first time a user types
 * a message, it doesn't stall loading the tokenizer.
 */
export const countModelTokens: (text: string, llmId: DLLMId, debugFrom: string) => number = (() => {
  // return () => 0;
  const tokenEncoders: { [modelId: string]: Tiktoken } = {};

  function tokenCount(text: string, llmId: DLLMId, debugFrom: string): number {
    const openaiLlmId = findOpenAILlmIdOrThrow(llmId);
    if (!(openaiLlmId in tokenEncoders)) {
      try {
        tokenEncoders[openaiLlmId] = encoding_for_model(openaiLlmId as TiktokenModel);
      } catch (e) {
        tokenEncoders[openaiLlmId] = get_encoding('cl100k_base');
      }
    }
    const count = tokenEncoders[openaiLlmId]?.encode(text)?.length || 0;
    if (DEBUG_TOKEN_COUNT)
      console.log(`countModelTokens: ${debugFrom}, ${llmId}, "${text.slice(0, 10)}": ${count}`);
    return count;
  }

  // preload the tokenizer for the default model
  const warmupId: DLLMId | null = defaultLLMId();
  if (warmupId)
    tokenCount('', warmupId, 'warmup');

  return tokenCount;
})();

/**
 * Convenience function to count the tokens in a DMessage object
 */
export const updateTokenCount = (message: DMessage, llmId: DLLMId, forceUpdate: boolean, debugFrom: string): number =>
  (!forceUpdate && message.tokenCount) ? message.tokenCount : (message.tokenCount = countModelTokens(message.text, llmId, debugFrom));
