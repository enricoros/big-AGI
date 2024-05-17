import type { Tiktoken, TiktokenEncoding, TiktokenModel } from 'tiktoken';

import { DLLMId, findLLMOrThrow } from '~/modules/llms/store-llms';


// Do not set this to true in production, it's very verbose
const DEBUG_TOKEN_COUNT = false;

// Globals
// const tokenEncodings: string[] = ['gpt2', 'r50k_base', 'p50k_base', 'p50k_edit', 'cl100k_base', 'o200k_base'] satisfies TiktokenEncoding[];

// Global symbols to dynamically load the Tiktoken library
let get_encoding: ((encoding: TiktokenEncoding) => Tiktoken) | null = null;
let encoding_for_model: ((model: TiktokenModel) => Tiktoken) | null = null;
let preloadPromise: Promise<void> | null = null;
let informTheUser = false;

/**
 * Preloads the Tiktoken library if not already loaded.
 * @returns {Promise<void>} A promise that resolves when the library is loaded.
 */
export function preloadTiktokenLibrary(): Promise<void> {
  if (!preloadPromise) {
    preloadPromise = import('tiktoken')
      .then(tiktoken => {
        get_encoding = tiktoken.get_encoding;
        encoding_for_model = tiktoken.encoding_for_model;
        if (informTheUser)
          console.warn('countModelTokens: Library loaded successfully');
      })
      .catch(error => {
        console.error('countModelTokens: Failed to load Tiktoken library:', error);
        preloadPromise = null; // Allow retrying if the import fails
        throw error; // Re-throw the error to inform the caller
      });
  }
  return preloadPromise;
}


/**
 * Wrapper around the Tiktoken library to keep tokenizers for all models in a cache.
 * Also, preloads the tokenizer for the default model to avoid initial stall.
 */
export const countModelTokens: (text: string, llmId: DLLMId, debugFrom: string) => number | null = (() => {
  // return () => 0;
  const tokenEncoders: { [modelId: string]: Tiktoken } = {};
  let encodingDefault: Tiktoken | null = null;

  /**
   * Counts the tokens in the given text for the specified model.
   * @param {string} text - The text to tokenize.
   * @param {DLLMId} llmId - The ID of the LLM.
   * @param {string} debugFrom - Debug information.
   * @returns {number | null} The token count or null if not ready.
   */
  function _tokenCount(text: string, llmId: DLLMId, debugFrom: string): number | null {

    // The library shall have been preloaded - if not, attempt to start its loading and return null to indicate we're not ready to count
    if (!encoding_for_model || !get_encoding) {
      if (!informTheUser) {
        console.warn('countModelTokens: Tiktoken library is not yet loaded, loading now...');
        informTheUser = true;
      }
      void preloadTiktokenLibrary(); // Attempt to preload without waiting.
      return null;
    }

    const openaiModel = findLLMOrThrow(llmId)?.options?.llmRef;
    if (!openaiModel) throw new Error(`LLM ${llmId} has no LLM reference id`);

    if (!(openaiModel in tokenEncoders)) {
      try {
        tokenEncoders[openaiModel] = encoding_for_model(openaiModel as TiktokenModel);
      } catch (e) {
        // fallback to the default encoding across all models (not just OpenAI - this will be used everywhere..)
        if (!encodingDefault)
          encodingDefault = get_encoding('cl100k_base');
        tokenEncoders[openaiModel] = encodingDefault;
      }
    }

    // Note: the try/catch shouldn't be necessary, but there could be corner cases where the tiktoken library throws
    // https://github.com/enricoros/big-agi/issues/182
    let count = 0;
    try {
      count = tokenEncoders[openaiModel]?.encode(text, 'all', [])?.length || 0;
    } catch (e) {
      console.error(`countModelTokens: Error tokenizing "${text.slice(0, 10)}..." with model '${openaiModel}': ${e}`);
    }
    if (DEBUG_TOKEN_COUNT)
      console.log(`countModelTokens: ${debugFrom}, ${llmId}, "${text.slice(0, 10)}": ${count}`);
    return count;
  }

  // NOTE: disabled on 2024-01-23, as the first load is more important than instant reactivity
  // preload the tokenizer for the default model
  // const { chatLLMId } = useModelsStore.getState();
  // if (chatLLMId)
  //   _tokenCount('', chatLLMId, 'warmup');

  return _tokenCount;
})();