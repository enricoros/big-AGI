import type { NextRequest } from 'next/server';
import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';

import { UiMessage } from '../../components/ChatMessage';


if (!process.env.OPENAI_API_KEY)
  console.warn('OPENAI_API_KEY has not been provided in this deployment environment. ' +
    'Will use the optional keys incoming from the client, which is not recommended.');


// definition for OpenAI wire types

interface ChatMessage {
  role: 'assistant' | 'system' | 'user';
  content: string;
}

interface ChatCompletionsRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
  stream: boolean;
  n: number;
}

interface ChatCompletionsResponseChunked {
  id: string; // unique id of this chunk
  object: 'chat.completion.chunk';
  created: number; // unix timestamp in seconds
  model: string; // can differ from the ask, e.g. 'gpt-4-0314'
  choices: {
    delta: Partial<ChatMessage>;
    index: number; // always 0s for n=1
    finish_reason: 'stop' | 'length' | null;
  }[];
}


async function OpenAIStream(apiKey: string, payload: Omit<ChatCompletionsRequest, 'stream' | 'n'>): Promise<ReadableStream> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const streamingPayload: ChatCompletionsRequest = {
    ...payload,
    stream: true,
    n: 1,
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    method: 'POST',
    body: JSON.stringify(streamingPayload),
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
          const json: ChatCompletionsResponseChunked = JSON.parse(event.data);

          // ignore any 'role' delta update
          if (json.choices[0].delta?.role)
            return;

          // stringify and send the first packet as a JSON object
          if (!sentFirstPacket) {
            sentFirstPacket = true;
            const firstPacket: ChatApiOutputStart = {
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
}


// Next.js API route

export interface ChatApiInput {
  apiKey?: string;
  messages: UiMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

/**
 * The client will be sent a stream of words. As an extra (an totally optional) 'data channel' we send a
 * string'ified JSON object with the few initial variables. We hope in the future to adopt a better
 * solution (e.g. websockets, but that will exclude deployment in Edge Functions).
 */
export interface ChatApiOutputStart {
  model: string;
}

export default async function handler(req: NextRequest) {

  // read inputs
  const { apiKey: userApiKey, messages, model = 'gpt-4', temperature = 0.5, max_tokens = 2048 }: ChatApiInput = await req.json();
  const chatGptInputMessages: ChatMessage[] = messages.map(({ role, text }) => ({
    role: role,
    content: text,
  }));

  // select key
  const apiKey = userApiKey || process.env.OPENAI_API_KEY || '';
  if (!apiKey)
    return new Response('Error: missing OpenAI API Key. Add it on the client side (Settings icon) or server side (your deployment).', { status: 400 });

  const stream: ReadableStream = await OpenAIStream(apiKey, {
    model,
    messages: chatGptInputMessages,
    temperature,
    max_tokens,
  });

  return new Response(stream);
};

//noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};
