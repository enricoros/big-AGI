import { encoding_for_model, get_encoding, Tiktoken } from '@dqbd/tiktoken';

import { ChatModelId, defaultChatModelId } from '@/lib/data';
import { DMessage } from '@/lib/store-chats';


// Do not set this to true in production, it's very verbose
const DEBUG_TOKEN_COUNT = false;


/**
 * Wrapper around the Tiktoken library, to keep tokenizers for all models in a cache
 *
 * We also preload the tokenizer for the default model, so that the first time a user types
 * a message, it doesn't stall loading the tokenizer.
 */
export const countModelTokens: (text: string, chatModelId: ChatModelId, debugFrom: string) => number = (() => {
  const tokenEncoders: { [modelId: string]: Tiktoken } = {};

  function tokenCount(text: string, chatModelId: ChatModelId, debugFrom: string): number {
    if (!(chatModelId in tokenEncoders)) {
      try {
        tokenEncoders[chatModelId] = encoding_for_model(chatModelId);
      } catch (e) {
        tokenEncoders[chatModelId] = get_encoding('cl100k_base');
      }
    }
    const count = tokenEncoders[chatModelId]?.encode(text)?.length || 0;
    if (DEBUG_TOKEN_COUNT)
      console.log(`countModelTokens: ${debugFrom}, ${chatModelId}, "${text.slice(0, 10)}": ${count}`);
    return count;
  }

  // preload the tokenizer for the default model
  tokenCount('', defaultChatModelId, 'warmup');

  return tokenCount;
})();

/**
 * Convenience function to count the tokens in a DMessage object
 */
export const updateTokenCount = (message: DMessage, chatModelId: ChatModelId, forceUpdate: boolean, debugFrom: string): number =>
  (!forceUpdate && message.tokenCount) ? message.tokenCount : (message.tokenCount = countModelTokens(message.text, chatModelId, debugFrom));
