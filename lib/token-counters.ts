import { encoding_for_model, get_encoding, Tiktoken } from '@dqbd/tiktoken';

import { ChatModelId, defaultChatModelId } from '@/lib/data';


/**
 * Wrapper around the Tiktoken library, to keep tokenizers for all models in a cache
 *
 * We also preload the tokenizer for the default model, so that the first time a user types
 * a message, it doesn't stall loading the tokenizer.
 */
export const countModelTokens: (text: string, chatModelId: ChatModelId) => number = (() => {
  const tokenEncoders: { [modelId: string]: Tiktoken } = {};

  function tokenCount(text: string, chatModelId: ChatModelId) {
    if (!(chatModelId in tokenEncoders)) {
      try {
        tokenEncoders[chatModelId] = encoding_for_model(chatModelId);
      } catch (e) {
        tokenEncoders[chatModelId] = get_encoding('cl100k_base');
      }
    }
    return tokenEncoders[chatModelId]?.encode(text)?.length || 0;
  }

  // preload the tokenizer for the default model
  tokenCount('', defaultChatModelId);

  return tokenCount;
})();
