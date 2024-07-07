import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { createParser as createEventsourceParser, EventSourceParseCallback, EventSourceParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';

import { createEmptyReadableStream, debugGenerateCurlCommand, nonTrpcServerFetchOrThrow, safeErrorString, SERVER_DEBUG_WIRE, serverCapitalizeFirstLetter, ServerFetchError } from '~/server/wire';


// Anthropic server imports
import { AnthropicWireMessagesResponse, anthropicWireMessagesResponseSchema } from './anthropic/anthropic.wiretypes';
import { anthropicAccess, anthropicAccessSchema, anthropicMessagesPayloadOrThrow } from './anthropic/anthropic.router';

// Gemini server imports
import { geminiAccess, geminiAccessSchema, geminiGenerateContentTextPayload } from './gemini/gemini.router';
import { geminiGeneratedContentResponseSchema, geminiModelsStreamGenerateContentPath } from './gemini/gemini.wiretypes';

// Ollama server imports
import { wireOllamaChunkedOutputSchema } from './ollama/ollama.wiretypes';
import { OLLAMA_PATH_CHAT, ollamaAccess, ollamaAccessSchema, ollamaChatCompletionPayload } from './ollama/ollama.router';

// OpenAI server imports
import type { OpenAIWire } from './openai/openai.wiretypes';
import { openAIAccess, openAIAccessSchema, openAIChatCompletionPayload, openAIHistorySchema, openAIModelSchema } from './openai/openai.router';


import { llmsStreamingContextSchema } from './llm.server.types';


// configuration
const USER_SYMBOL_MAX_TOKENS = '🧱';
const USER_SYMBOL_PROMPT_BLOCKED = '🚫';
// const USER_SYMBOL_NO_DATA_RECEIVED_BROKEN = '🔌';


/**
 * Event stream formats
 *  - 'sse' is the default format, and is used by all vendors except Ollama
 *  - 'json-nl' is used by Ollama
 */
type MuxingFormat = 'sse' | 'json-nl';


/**
 * Vendor stream parsers
 * - The vendor can decide to terminate the connection (close: true), transmitting anything in 'text' before doing so
 * - The vendor can also throw from this function, which will error and terminate the connection
 *
 * The peculiarity of our parser is the injection of a JSON structure at the beginning of the stream, to
 * communicate parameters before the text starts flowing to the client.
 */
type AIStreamParser = (data: string, eventType?: string) => { text: string, close: boolean };


const chatStreamingInputSchema = z.object({
  access: z.union([anthropicAccessSchema, geminiAccessSchema, ollamaAccessSchema, openAIAccessSchema]),
  model: openAIModelSchema,
  history: openAIHistorySchema,
  // NOTE: made it optional for now as we have some old requests without it
  // 2024-07-07: remove .optional()
  context: llmsStreamingContextSchema.optional(),
});
export type ChatStreamingInputSchema = z.infer<typeof chatStreamingInputSchema>;

// the purpose is to send something out even before the upstream stream starts, so that we keep the connection up
const chatStreamingStartOutputPacketSchema = z.object({
  type: z.enum(['start']),
});
export type ChatStreamingPreambleStartSchema = z.infer<typeof chatStreamingStartOutputPacketSchema>;

// the purpose is to have a first packet that contains the model name, so that the client can display it
// this is a hack until we have a better streaming format
const chatStreamingFirstOutputPacketSchema = z.object({
  model: z.string(),
});
export type ChatStreamingPreambleModelSchema = z.infer<typeof chatStreamingFirstOutputPacketSchema>;


export async function llmStreamingRelayHandler(req: NextRequest): Promise<Response> {

  // Parse the request
  const body = await req.json();
  const _chatStreamingInput: ChatStreamingInputSchema = chatStreamingInputSchema.parse(body);
  const { dialect: accessDialect } = _chatStreamingInput.access;
  const prettyDialect = serverCapitalizeFirstLetter(accessDialect);


  // Prepare the upstream API request and demuxer/parser
  let requestData: ReturnType<typeof _prepareRequestData>;
  try {
    requestData = _prepareRequestData(_chatStreamingInput);
  } catch (error: any) {
    console.error(`[POST] /api/llms/stream: ${prettyDialect}: prepareRequestData issue:`, safeErrorString(error));
    return new NextResponse(`**[Service Issue] ${prettyDialect}**: ${safeErrorString(error) || 'Unknown streaming error'}`, {
      status: 422,
    });
  }

  // Connect to the upstream (blocking)
  let upstreamResponse: Response;
  try {

    if (SERVER_DEBUG_WIRE)
      console.log('-> streaming:', debugGenerateCurlCommand('POST', requestData.url, requestData.headers, requestData.body));

    // POST to our API route
    // [MAY TIMEOUT] on Vercel Edge calls; this times out on long requests to Anthropic, on 2024-04-23.
    // The solution would be to return a new response with a 200 status code, and then stream the data
    // in a new request, but we'll lose back-pressure and complicates logic.
    upstreamResponse = await nonTrpcServerFetchOrThrow(requestData.url, 'POST', requestData.headers, requestData.body);

  } catch (error: any) {

    // server-side admins message
    const capDialect = serverCapitalizeFirstLetter(accessDialect);
    const fetchOrVendorError = safeErrorString(error) + (error?.cause ? ' · ' + JSON.stringify(error.cause) : '');
    console.error(`[POST] /api/llms/stream: ${capDialect}: fetch issue:`, fetchOrVendorError, requestData?.url);

    // client-side users visible message
    const statusCode = ((error instanceof ServerFetchError) && (error.statusCode >= 400)) ? error.statusCode : 422;
    const devMessage = process.env.NODE_ENV === 'development' ? ` [DEV_URL: ${requestData?.url}]` : '';
    return new NextResponse(`**[Service Issue] ${capDialect}**: ${fetchOrVendorError}${devMessage}`, {
      status: statusCode,
    });
  }

  /* The following code is heavily inspired by the Vercel AI SDK, but simplified to our needs and in full control.
   * This replaces the former (custom) implementation that used to return a ReadableStream directly, and upon start,
   * it was blindly fetching the upstream response and piping it to the client.
   *
   * We now use backpressure, as explained on: https://sdk.vercel.ai/docs/concepts/backpressure-and-cancellation
   *
   * NOTE: we have not benchmarked to see if there is performance impact by using this approach - we do want to have
   * a 'healthy' level of inventory (i.e., pre-buffering) on the pipe to the client.
   */
  const transformUpstreamToBigAgiClient = createUpstreamTransformer(
    requestData.vendorMuxingFormat, requestData.vendorStreamParser, accessDialect,
  );

  const chatResponseStream =
    (upstreamResponse.body || createEmptyReadableStream())
      .pipeThrough(transformUpstreamToBigAgiClient);

  return new NextResponse(chatResponseStream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
    },
  });
}


// Event Stream Transformers

/**
 * The default demuxer for EventSource upstreams.
 */
const _createDemuxerEventSource: (onParse: EventSourceParseCallback) => EventSourceParser = createEventsourceParser;

/**
 * Creates a parser for a 'JSON\n' non-event stream, to be swapped with an EventSource parser.
 * Ollama is the only vendor that uses this format.
 */
function _createDemuxerJsonNewline(onParse: EventSourceParseCallback): EventSourceParser {
  let accumulator: string = '';
  return {
    // feeds a new chunk to the parser - we accumulate in case of partial data, and only execute on full lines
    feed: (chunk: string): void => {
      accumulator += chunk;
      if (accumulator.endsWith('\n')) {
        for (const jsonString of accumulator.split('\n').filter(line => !!line)) {
          const mimicEvent: ParsedEvent = {
            type: 'event',
            id: undefined,
            event: undefined,
            data: jsonString,
          };
          onParse(mimicEvent);
        }
        accumulator = '';
      }
    },

    // resets the parser state - not useful with our driving of the parser
    reset: (): void => {
      console.error('createDemuxerJsonNewline.reset() not implemented');
    },
  };
}

/**
 * Creates a TransformStream that parses events from an EventSource stream using a custom parser.
 * @returns {TransformStream<Uint8Array, string>} TransformStream parsing events.
 */
function createUpstreamTransformer(muxingFormat: MuxingFormat, vendorTextParser: AIStreamParser, dialectLabel: string): TransformStream<Uint8Array, Uint8Array> {
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();
  let eventSourceParser: EventSourceParser;
  let hasReceivedData = false;

  return new TransformStream({
    start: async (controller): Promise<void> => {

      // Send initial packet indicating the start of the stream
      const startPacket: ChatStreamingPreambleStartSchema = { type: 'start' };
      controller.enqueue(textEncoder.encode(JSON.stringify(startPacket)));

      // only used for debugging
      let debugLastMs: number | null = null;

      const onNewEvent = (event: ParsedEvent | ReconnectInterval) => {
        if (SERVER_DEBUG_WIRE) {
          const nowMs = Date.now();
          const elapsedMs = debugLastMs ? nowMs - debugLastMs : 0;
          debugLastMs = nowMs;
          console.log(`<- SSE (${elapsedMs} ms):`, event);
        }

        // ignore 'reconnect-interval' and events with no data
        if (event.type !== 'event' || !('data' in event))
          return;

        // event stream termination, close our transformed stream
        if (event.data === '[DONE]') {
          controller.terminate();
          return;
        }

        try {
          const { text, close } = vendorTextParser(event.data, event.event);
          if (text)
            controller.enqueue(textEncoder.encode(text));
          if (close)
            controller.terminate();
        } catch (error: any) {
          if (SERVER_DEBUG_WIRE)
            console.log(' - E: parse issue:', event.data, error?.message || error);
          controller.enqueue(textEncoder.encode(` **[Stream Issue] ${serverCapitalizeFirstLetter(dialectLabel)}**: ${safeErrorString(error) || 'Unknown stream parsing error'}`));
          controller.terminate();
        }
      };

      if (muxingFormat === 'sse')
        eventSourceParser = _createDemuxerEventSource(onNewEvent);
      else if (muxingFormat === 'json-nl')
        eventSourceParser = _createDemuxerJsonNewline(onNewEvent);
    },

    // stream=true is set because the data is not guaranteed to be final and un-chunked
    transform: (chunk: Uint8Array) => {
      hasReceivedData = true;
      eventSourceParser.feed(textDecoder.decode(chunk, { stream: true }));
    },

    flush: (controller): void => {
      // if we get a flush() without having received any data, we should terminate the stream
      // NOTE: happens with Gemini on 2024-03-14
      if (!hasReceivedData) {
        controller.enqueue(textEncoder.encode(` **[Service Issue] ${serverCapitalizeFirstLetter(dialectLabel)}**: No data was sent by the server.`));
        controller.terminate();
      }
    },
  });
}


/// Stream Parsers

function createStreamParserAnthropicMessages(): AIStreamParser {
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
        return { text: `[Anthropic Server Error] ${errorText}`, close: true };

      default:
        throw new Error(`Unexpected event name: ${eventName}`);
    }

    return { text, close: false };
  };
}

function createStreamParserGemini(modelName: string): AIStreamParser {
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

function createStreamParserOllama(): AIStreamParser {
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

function createStreamParserOpenAI(): AIStreamParser {
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


function _prepareRequestData({ access, model, history, context: _context }: ChatStreamingInputSchema): {
  headers: HeadersInit;
  url: string;
  body: object;
  vendorMuxingFormat: MuxingFormat;
  vendorStreamParser: AIStreamParser;
} {
  switch (access.dialect) {
    case 'anthropic':
      return {
        ...anthropicAccess(access, '/v1/messages'),
        body: anthropicMessagesPayloadOrThrow(model, history, true),
        vendorMuxingFormat: 'sse',
        vendorStreamParser: createStreamParserAnthropicMessages(),
      };

    case 'gemini':
      return {
        ...geminiAccess(access, model.id, geminiModelsStreamGenerateContentPath),
        body: geminiGenerateContentTextPayload(model, history, access.minSafetyLevel, 1),
        vendorMuxingFormat: 'sse',
        vendorStreamParser: createStreamParserGemini(model.id.replace('models/', '')),
      };

    case 'ollama':
      return {
        ...ollamaAccess(access, OLLAMA_PATH_CHAT),
        body: ollamaChatCompletionPayload(model, history, access.ollamaJson, true),
        vendorMuxingFormat: 'json-nl',
        vendorStreamParser: createStreamParserOllama(),
      };

    case 'azure':
    case 'deepseek':
    case 'groq':
    case 'lmstudio':
    case 'localai':
    case 'mistral':
    case 'oobabooga':
    case 'openai':
    case 'openrouter':
    case 'perplexity':
    case 'togetherai':
      return {
        ...openAIAccess(access, model.id, '/v1/chat/completions'),
        body: openAIChatCompletionPayload(access.dialect, model, history, null, null, 1, true),
        vendorMuxingFormat: 'sse',
        vendorStreamParser: createStreamParserOpenAI(),
      };
  }
}