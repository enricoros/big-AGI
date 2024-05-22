import type { Tiktoken, TiktokenEncoding, TiktokenModel } from 'tiktoken';

import { DLLMId, findLLMOrThrow } from '~/modules/llms/store-llms';


// Do not set this to true in production, it's very verbose
const DEBUG_TOKEN_COUNT = false;
const fallbackEncodingId: TiktokenEncoding = 'cl100k_base';

// Globals
interface TiktokenTokenizer {
  id: TiktokenEncoding;
  label: string;
  exampleNet?: string;
}

export const TiktokenTokenizers: TiktokenTokenizer[] = [
  { id: 'o200k_base', label: 'O200k Base', exampleNet: 'GPT-4o' },
  { id: 'cl100k_base', label: 'CL100k Base' },
  { id: 'p50k_edit', label: 'P50k Edit' },
  { id: 'p50k_base', label: 'P50k Base' },
  { id: 'r50k_base', label: 'R50k Base' },
  { id: 'gpt2', label: 'GPT-2' },
];


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
 * @param {DLLMId} llmId - The ID of the LLM.
 * @param {string} debugFrom - Debug information.
 * @returns {number | null} The token count or null if not ready.
 */
export function countModelTokens(text: string, llmId: DLLMId, debugFrom: string): number | null {
  // The library shall have been preloaded - if not, attempt to start its loading and return null to indicate we're not ready to count
  if (!encoding_for_model || !get_encoding) {
    if (!informTheUser) {
      console.warn('countModelTokens: Tiktoken library is not yet loaded, loading now...');
      informTheUser = true;
    }
    void preloadTiktokenLibrary(); // Attempt to preload without waiting.
    return null;
  }

  // this will throw, so llmId better be found.. FIXME
  const openaiModel = findLLMOrThrow(llmId)?.options?.llmRef;
  if (!openaiModel) throw new Error(`LLM ${llmId} has no LLM reference id`);

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
    console.error(`countModelTokens: Error tokenizing "${text.slice(0, 10)}..." with model '${openaiModel}': ${e}`);
  }
  if (DEBUG_TOKEN_COUNT)
    console.log(`countModelTokens: ${debugFrom}, ${llmId}, "${text.slice(0, 10)}": ${count}`);
  return count;
}


/**
 * Counts the tokens in the given text for the specified tokenizer.
 * @param {string} text - The text to tokenize.
 * @param {string} encodingId - The ID of the tokenizer.
 * @param {string} debugFrom - Debug information.
 * @returns {Array<{ token: number, bytes: string }> | null} The detailed token information or null if not ready.
 */
export function countTokenizerTokens(text: string, encodingId: string, debugFrom: string): Array<TokenChunk> | null {
  // The library shall have been preloaded - if not, attempt to start its loading and return null to indicate we're not ready to count
  if (!get_encoding) {
    if (!informTheUser) {
      console.warn('countTokenizerTokens: Tiktoken library is not yet loaded, loading now...');
      informTheUser = true;
    }
    void preloadTiktokenLibrary(); // Attempt to preload without waiting.
    return null;
  }

  if (!(encodingId in tokenizerCache)) {
    try {
      tokenizerCache[encodingId] = get_encoding(encodingId as TiktokenEncoding);
    } catch (e) {
      console.error(`countTokenizerTokens: Error initializing tokenizer "${encodingId}": ${e}`);
      return null;
    }
  }

  try {
    const tokens = tokenizerCache[encodingId]?.encode(text, 'all', []) || new Uint32Array();
    if (DEBUG_TOKEN_COUNT)
      console.log(`countTokenizerTokens: ${debugFrom}, ${encodingId}, "${text.slice(0, 10)}": ${tokens.length}`);

    // for every token create an object {t:token, b: bytes}
    const tokenDetails: TokenChunk[] = [];
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
    console.error(`countTokenizerTokens: Error tokenizing "${text.slice(0, 10)}..." with tokenizer '${encodingId}': ${e}`);
    return null;
  }
}

interface TokenChunk {
  token: number;
  chunk: string;
  bytes: string;
}