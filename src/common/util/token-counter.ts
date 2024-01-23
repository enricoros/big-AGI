import type { Tiktoken, TiktokenEncoding, TiktokenModel } from 'tiktoken';

import { DLLMId, findLLMOrThrow } from '~/modules/llms/store-llms';


// Do not set this to true in production, it's very verbose
const DEBUG_TOKEN_COUNT = false;


// global symbols to dynamically load the Tiktoken library
let get_encoding: ((encoding: TiktokenEncoding) => Tiktoken) | null = null;
let encoding_for_model: ((model: TiktokenModel) => Tiktoken) | null = null;
let preloadPromise: Promise<void> | null = null;
let informTheUser = false;

export function preloadTiktokenLibrary() {
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
 * Wrapper around the Tiktoken library, to keep tokenizers for all models in a cache
 *
 * We also preload the tokenizer for the default model, so that the first time a user types
 * a message, it doesn't stall loading the tokenizer.
 */
export const countModelTokens: (text: string, llmId: DLLMId, debugFrom: string) => number | null = (() => {
  // return () => 0;
  const tokenEncoders: { [modelId: string]: Tiktoken } = {};
  let encodingCL100K: Tiktoken | null = null;

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

    const { options: { llmRef: openaiModel } } = findLLMOrThrow(llmId);
    if (!openaiModel) throw new Error(`LLM ${llmId} has no LLM reference id`);
    if (!(openaiModel in tokenEncoders)) {
      try {
        tokenEncoders[openaiModel] = encoding_for_model(openaiModel as TiktokenModel);
      } catch (e) {
        // make sure we recycle the default encoding across all models
        if (!encodingCL100K)
          encodingCL100K = get_encoding('cl100k_base');
        tokenEncoders[openaiModel] = encodingCL100K;
      }
    }
    let count: number = 0;
    // Note: the try/catch shouldn't be necessary, but there could be corner cases where the tiktoken library throws
    // https://github.com/enricoros/big-agi/issues/182
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