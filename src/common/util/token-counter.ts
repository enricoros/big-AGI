import { encoding_for_model, get_encoding, Tiktoken, TiktokenModel } from '@dqbd/tiktoken';

import { DLLMId } from '~/modules/llms/llm.types';
import { findLLMOrThrow } from '~/modules/llms/llm.client';
import { useModelsStore } from '~/modules/llms/store-llms';


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
    const { options: { llmRef: openaiModel } } = findLLMOrThrow(llmId);
    if (!openaiModel) throw new Error(`LLM ${llmId} has no LLM reference id`);
    if (!(openaiModel in tokenEncoders)) {
      try {
        tokenEncoders[openaiModel] = encoding_for_model(openaiModel as TiktokenModel);
      } catch (e) {
        tokenEncoders[openaiModel] = get_encoding('cl100k_base');
      }
    }
    const count = tokenEncoders[openaiModel]?.encode(text)?.length || 0;
    if (DEBUG_TOKEN_COUNT)
      console.log(`countModelTokens: ${debugFrom}, ${llmId}, "${text.slice(0, 10)}": ${count}`);
    return count;
  }

  // preload the tokenizer for the default model
  const { chatLLMId } = useModelsStore.getState();
  if (chatLLMId)
    tokenCount('', chatLLMId, 'warmup');

  return tokenCount;
})();