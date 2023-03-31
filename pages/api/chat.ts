import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';


if (!process.env.OPENAI_API_KEY)
  console.warn('OPENAI_API_KEY has not been provided in this deployment environment. ' +
    'Will use the optional keys incoming from the client, which is not recommended.');


// definition for OpenAI wire types

namespace OpenAIAPI.Chat {

  export interface CompletionMessage {
    role: 'assistant' | 'system' | 'user';
    content: string;
  }

  export interface CompletionsRequest {
    model: string;
    messages: CompletionMessage[];
    temperature?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    max_tokens?: number;
    stream: boolean;
    n: number;
  }

  export interface CompletionsResponseChunked {
    id: string; // unique id of this chunk
    object: 'chat.completion.chunk';
    created: number; // unix timestamp in seconds
    model: string; // can differ from the ask, e.g. 'gpt-4-0314'
    choices: {
      delta: Partial<CompletionMessage>;
      index: number; // always 0s for n=1
      finish_reason: 'stop' | 'length' | null;
    }[];
  }

}

async function OpenAIStream(apiKey: string, apiHost: string, payload: Omit<OpenAIAPI.Chat.CompletionsRequest, 'stream' | 'n'>, signal: AbortSignal): Promise<ReadableStream> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const streamingPayload: OpenAIAPI.Chat.CompletionsRequest = {
    ...payload,
    stream: true,
    n: 1,
  };

  try {
    const res = await fetch(`https://${apiHost}/v1/chat/completions`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      method: 'POST',
      body: JSON.stringify(streamingPayload),
      signal,
    });

    return new ReadableStream({
      async start(controller) {

        // handle errors here, to return them as custom text on the stream
        if (!res.ok) {
          let errorPayload: object = {};
          try {
            errorPayload = await res.json();
          } catch (e) {
            // ignore
          }
          // return custom text
          controller.enqueue(encoder.encode(`OpenAI API error: ${res.status} ${res.statusText} ${JSON.stringify(errorPayload)}`));
          controller.close();
          return;
        }

        // the first packet will have the model name
        let sentFirstPacket = false;

        // stream response (SSE) from OpenAI may be fragmented into multiple chunks
        // this ensures we properly read chunks and invoke an event for each SSE event stream
        const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
          // ignore reconnect interval
          if (event.type !== 'event')
            return;

          // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
          if (event.data === '[DONE]') {
            controller.close();
            return;
          }

          try {
            const json: OpenAIAPI.Chat.CompletionsResponseChunked = JSON.parse(event.data);

            // ignore any 'role' delta update
            if (json.choices[0].delta?.role)
              return;

            // stringify and send the first packet as a JSON object
            if (!sentFirstPacket) {
              sentFirstPacket = true;
              const firstPacket: ApiChatFirstOutput = {
                model: json.model,
              };
              controller.enqueue(encoder.encode(JSON.stringify(firstPacket)));
            }

            // transmit the text stream
            const text = json.choices[0].delta?.content || '';
            const queue = encoder.encode(text);
            controller.enqueue(queue);

          } catch (e) {
            // maybe parse error
            controller.error(e);
          }
        });

        // https://web.dev/streams/#asynchronous-iteration
        for await (const chunk of res.body as any)
          parser.feed(decoder.decode(chunk));

      },
    });

  } catch (error: any) {

    if (error.name === 'AbortError') {
      console.log('Fetch request aborted');
      return new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('Request aborted by the user.'));
          controller.close();
        },
      });
    } else {
      console.error('Fetch request failed:', error);
      return new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`{"model":"network error"}Network issue: ${error?.cause?.message}`));
          controller.close();
        },
      });
    }

  }

}


// Next.js API route

export interface ApiChatInput {
  apiKey?: string;
  apiHost?: string;
  model: string;
  messages: OpenAIAPI.Chat.CompletionMessage[];
  temperature?: number;
  max_tokens?: number;
}

/**
 * The client will be sent a stream of words. As an extra (an totally optional) 'data channel' we send a
 * string'ified JSON object with the few initial variables. We hope in the future to adopt a better
 * solution (e.g. websockets, but that will exclude deployment in Edge Functions).
 */
export interface ApiChatFirstOutput {
  model: string;
}

export default async function handler(req: NextRequest): Promise<Response> {

  const { apiKey: userApiKey, apiHost: userApiHost, model, messages, temperature = 0.5, max_tokens = 2048 } = await req.json() as ApiChatInput;
  const apiHost = (userApiHost || process.env.OPENAI_API_HOST || 'api.openai.com').replaceAll('https://', '');
  const apiKey = userApiKey || process.env.OPENAI_API_KEY || '';
  if (!apiKey)
    return new Response('Error: missing OpenAI API Key. Add it on the client side (Settings icon) or server side (your deployment).', { status: 400 });

  try {

    const stream: ReadableStream = await OpenAIStream(apiKey, apiHost, {
      model,
      messages,
      temperature,
      max_tokens,
    }, req.signal);

    return new NextResponse(stream);

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log('Fetch request aborted in handler');
      return new Response('Request aborted by the user.', { status: 499 }); // Use 499 status code for client closed request
    } else if (error.code === 'ECONNRESET') {
      console.log('Connection reset by the client in handler');
      return new Response('Connection reset by the client.', { status: 499 }); // Use 499 status code for client closed request
    } else {
      console.error('Fetch request failed:', error);
      return new Response('Error: Fetch request failed.', { status: 500 });
    }
  }

};

//noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};
