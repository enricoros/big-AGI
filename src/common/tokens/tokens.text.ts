import type { Tiktoken, TiktokenEncoding, TiktokenModel } from 'tiktoken';

import type { DLLM } from '~/common/stores/llms/llms.types';
import { getAllModelParameterValues } from '~/common/stores/llms/llms.parameters';


// Do not set this to true in production, it's very verbose
const DEBUG_TOKEN_COUNT = false;
const fallbackEncodingId: TiktokenEncoding = 'cl100k_base';


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
 * Wrapper around the Tiktoken library to keep tokenizers for all models and tokenizers in a cache.
 */
const tokenEncoders: { [modelId: string]: Tiktoken } = {};
const tokenizerCache: { [encodingId: string]: Tiktoken } = {};


/**
 * Counts the tokens in the given text for the specified model.
 * @param {string} text - The text to tokenize.
 * @param llm - The LLM to use for tokenization count.
 * @param {string} debugFrom - Debug information.
 * @returns {number | null} The token count or null if not ready.
 */
export function textTokensForLLM(text: string, llm: DLLM, debugFrom: string): number | null {
  // The library shall have been preloaded - if not, attempt to start its loading and return null to indicate we're not ready to count
  if (!encoding_for_model || !get_encoding) {
    if (!informTheUser) {
      console.warn('textTokensForLLM: Tiktoken library is not yet loaded, loading now...');
      informTheUser = true;
    }
    void preloadTiktokenLibrary(); // Attempt to preload without waiting.
    return null;
  }

  // Validate input
  const llmParameters = getAllModelParameterValues(llm.initialParameters, llm.userParameters);
  const openaiModel = llmParameters.llmRef;
  if (!openaiModel) {
    console.warn(`textTokensForLLM: LLM ${llm?.id} has no LLM reference id`);
    return null;
  }

  if (!(openaiModel in tokenEncoders)) {
    try {
      tokenEncoders[openaiModel] = encoding_for_model(openaiModel as TiktokenModel);
    } catch (e) {
      // Fallback to a known tokenizer if the model is not found
      if (!(fallbackEncodingId in tokenizerCache))
        tokenizerCache[fallbackEncodingId] = get_encoding(fallbackEncodingId);
      tokenEncoders[openaiModel] = tokenizerCache[fallbackEncodingId];
    }
  }

  // Note: the try/catch shouldn't be necessary, but there could be corner cases where the tiktoken library throws
  // https://github.com/enricoros/big-agi/issues/182
  let count = 0;
  try {
    count = tokenEncoders[openaiModel]?.encode(text, 'all', [])?.length || 0;
  } catch (e) {
    console.warn(`textTokensForLLM: Error tokenizing "${text.slice(0, 10)}..." with model '${openaiModel}': ${e}`);
  }
  if (DEBUG_TOKEN_COUNT)
    console.log(`textTokensForLLM: ${debugFrom}, ${llm?.id}, "${text.slice(0, 10)}": ${count}`);
  return count;
}


/**
 * Counts the tokens in the given text for the specified tokenizer.
 * @param {string} text - The text to tokenize.
 * @param {string} encodingId - The ID of the tokenizer.
 * @param {string} debugFrom - Debug information.
 * @returns {Array<{ token: number, bytes: string }> | null} The detailed token information or null if not ready.
 */
export function textTokensForEncodingId(text: string, encodingId: string, debugFrom: string): Array<UITokenChunk> | null {
  // The library shall have been preloaded - if not, attempt to start its loading and return null to indicate we're not ready to count
  if (!get_encoding) {
    if (!informTheUser) {
      console.warn('textTokensForEncodingId: Tiktoken library is not yet loaded, loading now...');
      informTheUser = true;
    }
    void preloadTiktokenLibrary(); // Attempt to preload without waiting.
    return null;
  }

  if (!(encodingId in tokenizerCache)) {
    try {
      tokenizerCache[encodingId] = get_encoding(encodingId as TiktokenEncoding);
    } catch (e) {
      console.error(`textTokensForEncodingId: Error initializing tokenizer "${encodingId}": ${e}`);
      return null;
    }
  }

  try {
    const tokens = tokenizerCache[encodingId]?.encode(text, 'all', []) || new Uint32Array();
    if (DEBUG_TOKEN_COUNT)
      console.log(`textTokensForEncodingId: ${debugFrom}, ${encodingId}, "${text.slice(0, 10)}": ${tokens.length}`);

    // for every token create an object {t:token, b: bytes}
    const tokenDetails: UITokenChunk[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const bytesForToken = tokenizerCache[encodingId].decode_single_token_bytes(tokens[i]);
      const stringForToken = String.fromCharCode(...bytesForToken);
      tokenDetails.push({
        token: tokens[i],
        chunk: stringForToken,
        bytes: bytesForToken.join(', '),
      });
    }
    return tokenDetails;
  } catch (e) {
    console.error(`textTokensForEncodingId: Error tokenizing "${text.slice(0, 10)}..." with tokenizer '${encodingId}': ${e}`);
    return null;
  }
}

interface UITokenChunk {
  token: number;
  chunk: string;
  bytes: string;
}