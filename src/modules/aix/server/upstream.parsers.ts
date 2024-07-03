import { safeErrorString } from '~/server/wire';

import type { ChatStreamingPreambleModelSchema } from '~/modules/llms/server/llm.server.streaming';
import type { OpenAIWire } from '~/modules/llms/server/openai/openai.wiretypes';
import { AnthropicWireMessagesResponse, anthropicWireMessagesResponseSchema } from '~/modules/llms/server/anthropic/anthropic.wiretypes';
import { geminiGeneratedContentResponseSchema } from '~/modules/llms/server/gemini/gemini.wiretypes';
import { wireOllamaChunkedOutputSchema } from '~/modules/llms/server/ollama/ollama.wiretypes';


// configuration
const USER_SYMBOL_MAX_TOKENS = '🧱';
const USER_SYMBOL_PROMPT_BLOCKED = '🚫';
// const USER_SYMBOL_NO_DATA_RECEIVED_BROKEN = '🔌';


/**
 * Vendor stream parsers
 * - The vendor can decide to terminate the connection (close: true), transmitting anything in 'text' before doing so
 * - The vendor can also throw from this function, which will error and terminate the connection
 *
 * The peculiarity of our parser is the injection of a JSON structure at the beginning of the stream, to
 * communicate parameters before the text starts flowing to the client.
 */
export type UpstreamEventParseFunction = (eventData: string, eventName?: string) => { text: string, close: boolean };


/// Stream Parsers

export function createStreamParserAnthropicMessages(): UpstreamEventParseFunction {
  let responseMessage: AnthropicWireMessagesResponse | null = null;
  let hasErrored = false;

  // Note: at this stage, the parser only returns the text content as text, which is streamed as text
  //       to the client. It is however building in parallel the responseMessage object, which is not
  //       yet used, but contains token counts, for instance.
  return (data: string, eventName?: string) => {
    let text = '';

    // if we've errored, we should not be receiving more data
    if (hasErrored)
      console.log('Anthropic stream has errored already, but received more data:', data);

    switch (eventName) {
      // Ignore pings
      case 'ping':
        break;

      // Initialize the message content for a new message
      case 'message_start':
        const firstMessage = !responseMessage;
        const { message } = JSON.parse(data);
        responseMessage = anthropicWireMessagesResponseSchema.parse(message);
        // hack: prepend the model name to the first packet
        if (firstMessage) {
          const firstPacket: ChatStreamingPreambleModelSchema = { model: responseMessage.model };
          text = JSON.stringify(firstPacket);
        }
        break;

      // Initialize content block if needed
      case 'content_block_start':
        if (responseMessage) {
          const { index, content_block } = JSON.parse(data);
          if (responseMessage.content[index] === undefined)
            responseMessage.content[index] = content_block;
          text = responseMessage.content[index].text;
        } else
          throw new Error('Unexpected content block start');
        break;

      // Append delta text to the current message content
      case 'content_block_delta':
        if (responseMessage) {
          const { index, delta } = JSON.parse(data);
          if (delta.type !== 'text_delta')
            throw new Error(`Unexpected content block non-text delta (${delta.type})`);
          if (responseMessage.content[index] === undefined)
            throw new Error(`Unexpected content block delta location (${index})`);
          responseMessage.content[index].text += delta.text;
          text = delta.text;
        } else
          throw new Error('Unexpected content block delta');
        break;

      // Finalize content block if needed.
      case 'content_block_stop':
        if (responseMessage) {
          const { index } = JSON.parse(data);
          if (responseMessage.content[index] === undefined)
            throw new Error(`Unexpected content block end location (${index})`);
        } else
          throw new Error('Unexpected content block stop');
        break;

      // Optionally handle top-level message changes. Example: updating stop_reason
      case 'message_delta':
        if (responseMessage) {
          const { delta } = JSON.parse(data);
          Object.assign(responseMessage, delta);
        } else
          throw new Error('Unexpected message delta');
        break;

      // We can now close the message
      case 'message_stop':
        return { text: '', close: true };

      // Occasionaly, the server will send errors, such as {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}
      case 'error':
        hasErrored = true;
        const { error } = JSON.parse(data);
        const errorText = (error.type && error.message) ? `${error.type}: ${error.message}` : safeErrorString(error);
        return { text: `[Anthropic Server-side Error] ${errorText}`, close: true };

      default:
        throw new Error(`Unexpected event name: ${eventName}`);
    }

    return { text, close: false };
  };
}

export function createStreamParserGemini(modelName: string): UpstreamEventParseFunction {
  let hasBegun = false;

  // this can throw, it's catched upstream
  return (data: string) => {

    // parse the JSON chunk
    const wireGenerationChunk = JSON.parse(data);
    let generationChunk: ReturnType<typeof geminiGeneratedContentResponseSchema.parse>;
    try {
      generationChunk = geminiGeneratedContentResponseSchema.parse(wireGenerationChunk);
    } catch (error: any) {
      // log the malformed data to the console, and rethrow to transmit as 'error'
      console.log(`/api/llms/stream: Gemini parsing issue: ${error?.message || error}`, wireGenerationChunk);
      throw error;
    }

    // Prompt Safety Errors: pass through errors from Gemini
    if (generationChunk.promptFeedback?.blockReason) {
      const { blockReason, safetyRatings } = generationChunk.promptFeedback;
      return { text: `${USER_SYMBOL_PROMPT_BLOCKED} [Gemini Prompt Blocked] ${blockReason}: ${JSON.stringify(safetyRatings || 'Unknown Safety Ratings', null, 2)}`, close: true };
    }

    // expect a single completion
    const singleCandidate = generationChunk.candidates?.[0] ?? null;
    if (!singleCandidate)
      throw new Error(`expected 1 completion, got ${generationChunk.candidates?.length}`);

    // no contents: could be an expected or unexpected condition
    if (!singleCandidate.content) {
      if (singleCandidate.finishReason === 'MAX_TOKENS')
        return { text: ` ${USER_SYMBOL_MAX_TOKENS}`, close: true };
      if (singleCandidate.finishReason === 'RECITATION')
        throw new Error('generation stopped due to RECITATION');
      throw new Error(`server response missing content (finishReason: ${singleCandidate?.finishReason})`);
    }

    // expect a single part
    if (singleCandidate.content.parts?.length !== 1 || !('text' in singleCandidate.content.parts[0]))
      throw new Error(`expected 1 text part, got ${singleCandidate.content.parts?.length}`);

    // expect a single text in the part
    let text = singleCandidate.content.parts[0].text || '';

    // hack: prepend the model name to the first packet
    if (!hasBegun) {
      hasBegun = true;
      const firstPacket: ChatStreamingPreambleModelSchema = { model: modelName };
      text = JSON.stringify(firstPacket) + text;
    }

    return { text, close: false };
  };
}

export function createStreamParserOllama(): UpstreamEventParseFunction {
  let hasBegun = false;

  return (data: string) => {

    // parse the JSON chunk
    let wireJsonChunk: any;
    try {
      wireJsonChunk = JSON.parse(data);
    } catch (error: any) {
      // log the malformed data to the console, and rethrow to transmit as 'error'
      console.log(`/api/llms/stream: Ollama parsing issue: ${error?.message || error}`, data);
      throw error;
    }

    // validate chunk
    const chunk = wireOllamaChunkedOutputSchema.parse(wireJsonChunk);

    // pass through errors from Ollama
    if ('error' in chunk)
      throw new Error(chunk.error);

    // process output
    let text = chunk.message?.content || /*chunk.response ||*/ '';

    // hack: prepend the model name to the first packet
    if (!hasBegun && chunk.model) {
      hasBegun = true;
      const firstPacket: ChatStreamingPreambleModelSchema = { model: chunk.model };
      text = JSON.stringify(firstPacket) + text;
    }

    return { text, close: chunk.done };
  };
}

export function createStreamParserOpenAI(): UpstreamEventParseFunction {
  let hasBegun = false;
  let hasWarned = false;

  return (data: string) => {

    const json: OpenAIWire.ChatCompletion.ResponseStreamingChunk = JSON.parse(data);

    // [OpenAI] an upstream error will be handled gracefully and transmitted as text (throw to transmit as 'error')
    if (json.error)
      return { text: `[OpenAI Issue] ${safeErrorString(json.error)}`, close: true };

    // [OpenAI] if there's a warning, log it once
    if (json.warning && !hasWarned) {
      hasWarned = true;
      console.log('/api/llms/stream: OpenAI upstream warning:', json.warning);
    }

    if (json.choices.length !== 1) {
      // [Azure] we seem to 'prompt_annotations' or 'prompt_filter_results' objects - which we will ignore to suppress the error
      if (json.id === '' && json.object === '' && json.model === '')
        return { text: '', close: false };
      throw new Error(`Expected 1 completion, got ${json.choices.length}`);
    }

    const index = json.choices[0].index;
    if (index !== 0 && index !== undefined /* LocalAI hack/workaround until https://github.com/go-skynet/LocalAI/issues/788 */)
      throw new Error(`Expected completion index 0, got ${index}`);
    let text = json.choices[0].delta?.content /*|| json.choices[0]?.text*/ || '';

    // hack: prepend the model name to the first packet
    if (!hasBegun) {
      hasBegun = true;
      const firstPacket: ChatStreamingPreambleModelSchema = { model: json.model };
      text = JSON.stringify(firstPacket) + text;
    }

    // [LocalAI] workaround: LocalAI doesn't send the [DONE] event, but similarly to OpenAI, it sends a "finish_reason" delta update
    const close = !!json.choices[0].finish_reason;
    return { text, close };
  };
}
