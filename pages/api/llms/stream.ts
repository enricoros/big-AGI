import { NextRequest, NextResponse } from 'next/server';
import { createParser as createEventsourceParser, EventSourceParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';

import { AnthropicWire } from '~/modules/llms/anthropic/anthropic.types';
import { OpenAI } from '~/modules/llms/openai/openai.types';
import { anthropicAccess, anthropicCompletionRequest } from '~/modules/llms/anthropic/anthropic.router';
import { chatStreamSchema, openAIAccess, openAIChatCompletionPayload } from '~/modules/llms/openai/openai.router';


/**
 * Vendor stream parsers
 * - The vendor can decide to terminate the connection (close: true), transmitting anything in 'text' before doing so
 * - The vendor can also throw from this function, which will error and terminate the connection
 */
type AIStreamParser = (data: string) => { text: string, close: boolean };


// The peculiarity of our parser is the injection of a JSON structure at the beginning of the stream, to
// communicate parameters before the text starts flowing to the client.
function parseOpenAIStream(): AIStreamParser {
  let hasBegun = false;
  let hasWarned = false;

  return data => {

    const json: OpenAI.Wire.ChatCompletion.ResponseStreamingChunk = JSON.parse(data);

    // an upstream error will be handled gracefully and transmitted as text (throw to transmit as 'error')
    if (json.error)
      return { text: `[OpenAI Issue] ${json.error.message || json.error}`, close: true };

    if (json.choices.length !== 1)
      throw new Error(`[OpenAI Issue] Expected 1 completion, got ${json.choices.length}`);

    const index = json.choices[0].index;
    if (index !== 0 && index !== undefined /* LocalAI hack/workaround until https://github.com/go-skynet/LocalAI/issues/788 */)
      throw new Error(`[OpenAI Issue] Expected completion index 0, got ${index}`);
    let text = json.choices[0].delta?.content /*|| json.choices[0]?.text*/ || '';

    // hack: prepend the model name to the first packet
    if (!hasBegun) {
      hasBegun = true;
      const firstPacket: OpenAI.API.Chat.StreamingFirstResponse = {
        model: json.model,
      };
      text = JSON.stringify(firstPacket) + text;
    }

    // if there's a warning, log it once
    if (json.warning && !hasWarned) {
      hasWarned = true;
      console.log('/api/llms/stream: OpenAI stream warning:', json.warning);
    }

    // workaround: LocalAI doesn't send the [DONE] event, but similarly to OpenAI, it sends a "finish_reason" delta update
    const close = !!json.choices[0].finish_reason;
    return { text, close };
  };
}


// Anthropic event stream parser
function parseAnthropicStream(): AIStreamParser {
  let hasBegun = false;

  return data => {

    const json: AnthropicWire.Complete.Response = JSON.parse(data);
    let text = json.completion;

    // hack: prepend the model name to the first packet
    if (!hasBegun) {
      hasBegun = true;
      const firstPacket: OpenAI.API.Chat.StreamingFirstResponse = {
        model: json.model,
      };
      text = JSON.stringify(firstPacket) + text;
    }

    return { text, close: false };
  };
}


/**
 * Creates a TransformStream that parses events from an EventSource stream using a custom parser.
 * @returns {TransformStream<Uint8Array, string>} TransformStream parsing events.
 */
export function createEventStreamTransformer(vendorTextParser: AIStreamParser): TransformStream<Uint8Array, Uint8Array> {
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();
  let eventSourceParser: EventSourceParser;

  return new TransformStream({
    start: async (controller): Promise<void> => {
      eventSourceParser = createEventsourceParser(
        (event: ParsedEvent | ReconnectInterval) => {

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
            controller.enqueue(textEncoder.encode(`[Stream Issue] ${error?.message || error}`));
            controller.terminate();
          }
        },
      );
    },

    // stream=true is set because the data is not guaranteed to be final and un-chunked
    transform: (chunk: Uint8Array) => {
      eventSourceParser.feed(textDecoder.decode(chunk, { stream: true }));
    },
  });
}

export async function throwResponseNotOk(response: Response) {
  if (!response.ok) {
    const errorPayload: object | null = await response.json().catch(() => null);
    throw new Error(`${response.status} · ${response.statusText}${errorPayload ? ' · ' + JSON.stringify(errorPayload) : ''}`);
  }
}

export function createEmptyReadableStream<T = Uint8Array>(): ReadableStream<T> {
  return new ReadableStream({
    start: (controller) => controller.close(),
  });
}


export default async function handler(req: NextRequest): Promise<Response> {

  // inputs - reuse the tRPC schema
  const { vendorId, access, model, history } = chatStreamSchema.parse(await req.json());

  // begin event streaming from the OpenAI API
  let upstreamResponse: Response;
  let vendorStreamParser: AIStreamParser;
  try {

    // prepare the API request data
    let headersUrl: { headers: HeadersInit, url: string };
    let body: object;
    switch (vendorId) {
      case 'anthropic':
        headersUrl = anthropicAccess(access as any, '/v1/complete');
        body = anthropicCompletionRequest(model, history, true);
        vendorStreamParser = parseAnthropicStream();
        break;

      case 'openai':
        headersUrl = openAIAccess(access as any, '/v1/chat/completions');
        body = openAIChatCompletionPayload(model, history, null, 1, true);
        vendorStreamParser = parseOpenAIStream();
        break;
    }

    // POST to our API route
    upstreamResponse = await fetch(headersUrl.url, {
      method: 'POST',
      headers: headersUrl.headers,
      body: JSON.stringify(body),
    });
    await throwResponseNotOk(upstreamResponse);

  } catch (error: any) {
    const fetchOrVendorError = (error?.message || typeof error === 'string' ? error : JSON.stringify(error)) + (error?.cause ? ' · ' + error.cause : '');
    console.log(`/api/llms/stream: fetch issue: ${fetchOrVendorError}`);
    return new NextResponse('[OpenAI Issue] ' + fetchOrVendorError, { status: 500 });
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
    .pipeThrough(createEventStreamTransformer(vendorStreamParser));

  return new NextResponse(chatResponseStream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
    },
  });
}

// noinspection JSUnusedGlobalSymbols
export const runtime = 'edge';