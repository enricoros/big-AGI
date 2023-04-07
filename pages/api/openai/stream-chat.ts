import { NextRequest, NextResponse } from 'next/server';
import { createParser } from 'eventsource-parser';


if (!process.env.OPENAI_API_KEY)
  console.warn(
    'OPENAI_API_KEY has not been provided in this deployment environment. ' +
    'Will use the optional keys incoming from the client, which is not recommended.',
  );


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


async function fetchOpenAIChatCompletions(
  apiCommon: ApiCommonInputs,
  completionRequest: Omit<OpenAIAPI.Chat.CompletionsRequest, 'stream' | 'n'>,
  signal: AbortSignal,
): Promise<Response> {

  const streamingCompletionRequest: OpenAIAPI.Chat.CompletionsRequest = {
    ...completionRequest,
    stream: true,
    n: 1,
  };

  const response = await fetch(`https://${apiCommon.apiHost}/v1/chat/completions`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiCommon.apiKey}`,
      ...(apiCommon.apiOrgId && { 'OpenAI-Organization': apiCommon.apiOrgId }),
    },
    method: 'POST',
    body: JSON.stringify(streamingCompletionRequest),
    signal,
  });

  if (!response.ok) {
    // try to parse the OpenAI error payload (incl. description)
    let errorPayload: object | null = null;
    try {
      errorPayload = await response.json();
    } catch (e) {
      // ignore
    }
    throw new Error(`${response.status} · ${response.statusText}${errorPayload ? ' · ' + JSON.stringify(errorPayload) : ''}`);
  }

  return response;
}


// error function: send them down the stream as text
const sendErrorAndClose = (controller: ReadableStreamDefaultController, encoder: TextEncoder, message: string) => {
  controller.enqueue(encoder.encode(message));
  controller.close();
};


async function chatStreamRepeater(apiCommon: ApiCommonInputs, payload: Omit<OpenAIAPI.Chat.CompletionsRequest, 'stream' | 'n'>, signal: AbortSignal): Promise<ReadableStream> {
  const encoder = new TextEncoder();

  // Handle the abort event when the connection is closed by the client
  signal.addEventListener('abort', () => {
    console.log('Client closed the connection.');
  });

  // begin event streaming from the OpenAI API

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetchOpenAIChatCompletions(apiCommon, payload, signal);
  } catch (error: any) {
    console.log(error);
    const message = '[OpenAI Issue] ' + (error?.message || typeof error === 'string' ? error : JSON.stringify(error)) + (error?.cause ? ' · ' + error.cause : '');
    return new ReadableStream({
      start: controller => sendErrorAndClose(controller, encoder, message),
    });
  }

  // decoding and re-encoding loop

  const onReadableStreamStart = async (controller: ReadableStreamDefaultController) => {

    let hasBegun = false;

    // stream response (SSE) from OpenAI is split into multiple chunks. this function
    // will parse the event into a text stream, and re-emit it to the client
    const upstreamParser = createParser(event => {

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
        if (!hasBegun) {
          hasBegun = true;
          const firstPacket: ApiChatFirstOutput = {
            model: json.model,
          };
          controller.enqueue(encoder.encode(JSON.stringify(firstPacket)));
        }

        // transmit the text stream
        const text = json.choices[0].delta?.content || '';
        controller.enqueue(encoder.encode(text));

      } catch (error) {
        // maybe parse error
        console.error('Error parsing OpenAI response', error);
        controller.error(error);
      }
    });

    // https://web.dev/streams/#asynchronous-iteration
    const decoder = new TextDecoder();
    for await (const upstreamChunk of upstreamResponse.body as any)
      upstreamParser.feed(decoder.decode(upstreamChunk));

  };

  return new ReadableStream({
    start: onReadableStreamStart,
    cancel: (reason) => console.log('chatStreamRepeater cancelled', reason),
  });
}


// Next.js API route

interface ApiCommonInputs {
  apiKey?: string;
  apiHost?: string;
  apiOrgId?: string;
}

export interface ApiChatInput extends ApiCommonInputs {
  model: string;
  messages: ApiChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export type ApiChatMessage = OpenAIAPI.Chat.CompletionMessage;


/**
 * The client will be sent a stream of words. As an extra (an totally optional) 'data channel' we send a
 * string JSON object with the few initial variables. We hope in the future to adopt a better
 * solution (e.g. websockets, but that will exclude deployment in Edge Functions).
 */
export interface ApiChatFirstOutput {
  model: string;
}


export default async function handler(req: NextRequest): Promise<Response> {
  const {
    apiKey: userApiKey, apiHost: userApiHost, apiOrgId: userApiOrgId,
    model, messages,
    temperature = 0.5, max_tokens = 2048,
  } = await req.json() as ApiChatInput;

  const apiCommon: ApiCommonInputs = {
    apiKey: (userApiKey || process.env.OPENAI_API_KEY || '').trim(),
    apiHost: (userApiHost || process.env.OPENAI_API_HOST || 'api.openai.com').trim().replaceAll('https://', ''),
    apiOrgId: (userApiOrgId || process.env.OPENAI_API_ORG_ID || '').trim(),
  };
  if (!apiCommon.apiKey)
    return new Response('[Issue] missing OpenAI API Key. Add it on the client side (Settings icon) or server side (your deployment).', { status: 400 });

  try {

    const stream: ReadableStream = await chatStreamRepeater(apiCommon, {
      model, messages,
      temperature, max_tokens,
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
      return new Response('[Issue] Fetch request failed.', { status: 500 });
    }
  }

};

//noinspection JSUnusedGlobalSymbols
export const config = {
  runtime: 'edge',
};