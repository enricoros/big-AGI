import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { createParser as createEventsourceParser, EventSourceParseCallback, EventSourceParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';

import { createEmptyReadableStream, debugGenerateCurlCommand, safeErrorString, SERVER_DEBUG_WIRE, serverFetchOrThrow } from '~/server/wire';

import type { AnthropicWire } from '../anthropic/anthropic.wiretypes';
import type { OpenAIWire } from './openai.wiretypes';
import { anthropicAccess, anthropicAccessSchema, anthropicChatCompletionPayload } from '../anthropic/anthropic.router';
import { ollamaAccess, ollamaAccessSchema, ollamaChatCompletionPayload } from '../ollama/ollama.router';
import { openAIAccess, openAIAccessSchema, openAIChatCompletionPayload, openAIHistorySchema, openAIModelSchema } from './openai.router';
import { wireOllamaGenerationSchema } from '../ollama/ollama.wiretypes';


/**
 * Vendor stream parsers
 * - The vendor can decide to terminate the connection (close: true), transmitting anything in 'text' before doing so
 * - The vendor can also throw from this function, which will error and terminate the connection
 *
 * The peculiarity of our parser is the injection of a JSON structure at the beginning of the stream, to
 * communicate parameters before the text starts flowing to the client.
 */
export type AIStreamParser = (data: string) => { text: string, close: boolean };

type EventStreamFormat = 'sse' | 'json-nl';


const chatStreamInputSchema = z.object({
  access: z.union([anthropicAccessSchema, ollamaAccessSchema, openAIAccessSchema]),
  model: openAIModelSchema, history: openAIHistorySchema,
});
export type ChatStreamInputSchema = z.infer<typeof chatStreamInputSchema>;

const chatStreamFirstPacketSchema = z.object({
  model: z.string(),
});
export type ChatStreamFirstPacketSchema = z.infer<typeof chatStreamFirstPacketSchema>;


export async function openaiStreamingRelayHandler(req: NextRequest): Promise<Response> {

  // inputs - reuse the tRPC schema
  const { access, model, history } = chatStreamInputSchema.parse(await req.json());

  // begin event streaming from the OpenAI API
  let headersUrl: { headers: HeadersInit, url: string } = { headers: {}, url: '' };
  let upstreamResponse: Response;
  let vendorStreamParser: AIStreamParser;
  let eventStreamFormat: EventStreamFormat = 'sse';
  try {

    // prepare the API request data
    let body: object;
    switch (access.dialect) {
      case 'anthropic':
        headersUrl = anthropicAccess(access, '/v1/complete');
        body = anthropicChatCompletionPayload(model, history, true);
        vendorStreamParser = createAnthropicStreamParser();
        break;

      case 'ollama':
        headersUrl = ollamaAccess(access, '/api/generate');
        body = ollamaChatCompletionPayload(model, history, true);
        eventStreamFormat = 'json-nl';
        vendorStreamParser = createOllamaStreamParser();
        break;

      case 'azure':
      case 'localai':
      case 'oobabooga':
      case 'openai':
      case 'openrouter':
        headersUrl = openAIAccess(access, model.id, '/v1/chat/completions');
        body = openAIChatCompletionPayload(model, history, null, null, 1, true);
        vendorStreamParser = createOpenAIStreamParser();
        break;
    }

    if (SERVER_DEBUG_WIRE)
      console.log('-> streaming:', debugGenerateCurlCommand('POST', headersUrl.url, headersUrl.headers, body));

    // POST to our API route
    upstreamResponse = await serverFetchOrThrow(headersUrl.url, 'POST', headersUrl.headers, body);

  } catch (error: any) {
    const fetchOrVendorError = safeErrorString(error) + (error?.cause ? ' · ' + error.cause : '');

    // server-side admins message
    console.error(`/api/llms/stream: fetch issue:`, access.dialect, fetchOrVendorError, headersUrl?.url);

    // client-side users visible message
    return new NextResponse(`[Issue] ${access.dialect}: ${fetchOrVendorError}`
      + (process.env.NODE_ENV === 'development' ? ` · [URL: ${headersUrl?.url}]` : ''), { status: 500 });
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
  const chatResponseStream = (upstreamResponse.body || createEmptyReadableStream())
    .pipeThrough(createEventStreamTransformer(vendorStreamParser, eventStreamFormat, access.dialect));

  return new NextResponse(chatResponseStream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
    },
  });
}


/// Event Parsers

function createAnthropicStreamParser(): AIStreamParser {
  let hasBegun = false;

  return (data: string) => {

    const json: AnthropicWire.Complete.Response = JSON.parse(data);
    let text = json.completion;

    // hack: prepend the model name to the first packet
    if (!hasBegun) {
      hasBegun = true;
      const firstPacket: ChatStreamFirstPacketSchema = { model: json.model };
      text = JSON.stringify(firstPacket) + text;
    }

    return { text, close: false };
  };
}

function createOllamaStreamParser(): AIStreamParser {
  let hasBegun = false;

  return (data: string) => {

    let wireGeneration: any;
    try {
      wireGeneration = JSON.parse(data);
    } catch (error: any) {
      // log the malformed data to the console, and rethrow to transmit as 'error'
      console.log(`/api/llms/stream: Ollama parsing issue: ${error?.message || error}`, data);
      throw error;
    }
    const generation = wireOllamaGenerationSchema.parse(wireGeneration);
    let text = generation.response;

    // hack: prepend the model name to the first packet
    if (!hasBegun) {
      hasBegun = true;
      const firstPacket: ChatStreamFirstPacketSchema = { model: generation.model };
      text = JSON.stringify(firstPacket) + text;
    }

    return { text, close: generation.done };
  };
}

function createOpenAIStreamParser(): AIStreamParser {
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
      const firstPacket: ChatStreamFirstPacketSchema = { model: json.model };
      text = JSON.stringify(firstPacket) + text;
    }

    // [LocalAI] workaround: LocalAI doesn't send the [DONE] event, but similarly to OpenAI, it sends a "finish_reason" delta update
    const close = !!json.choices[0].finish_reason;
    return { text, close };
  };
}


// Event Stream Transformers

/**
 * Creates a TransformStream that parses events from an EventSource stream using a custom parser.
 * @returns {TransformStream<Uint8Array, string>} TransformStream parsing events.
 */
function createEventStreamTransformer(vendorTextParser: AIStreamParser, inputFormat: EventStreamFormat, dialectLabel: string): TransformStream<Uint8Array, Uint8Array> {
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();
  let eventSourceParser: EventSourceParser;

  return new TransformStream({
    start: async (controller): Promise<void> => {

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
          const { text, close } = vendorTextParser(event.data);
          if (text)
            controller.enqueue(textEncoder.encode(text));
          if (close)
            controller.terminate();
        } catch (error: any) {
          // console.log(`/api/llms/stream: parse issue: ${error?.message || error}`);
          controller.enqueue(textEncoder.encode(`[Stream Issue] ${dialectLabel}: ${safeErrorString(error) || 'Unknown stream parsing error'}`));
          controller.terminate();
        }
      };

      if (inputFormat === 'sse')
        eventSourceParser = createEventsourceParser(onNewEvent);
      else if (inputFormat === 'json-nl')
        eventSourceParser = createJsonNewlineParser(onNewEvent);
    },

    // stream=true is set because the data is not guaranteed to be final and un-chunked
    transform: (chunk: Uint8Array) => {
      eventSourceParser.feed(textDecoder.decode(chunk, { stream: true }));
    },
  });
}

/**
 * Creates a parser for a 'JSON\n' non-event stream, to be swapped with an EventSource parser.
 * Ollama is the only vendor that uses this format.
 */
function createJsonNewlineParser(onParse: EventSourceParseCallback): EventSourceParser {
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
      console.error('createJsonNewlineParser.reset() not implemented');
    },
  };
}
