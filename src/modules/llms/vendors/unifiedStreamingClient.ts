import { apiAsync } from '~/common/util/trpc.client';
import { frontendSideFetch } from '~/common/util/clientFetchers';

import type { ChatStreamingFirstOutputPacketSchema, ChatStreamingInputSchema } from '../server/llm.server.streaming';
import type { DLLMId } from '../store-llms';
import type { VChatFunctionIn, VChatMessageIn } from '../llm.client';

import type { OpenAIAccessSchema } from '../server/openai/openai.router';
import type { OpenAIWire } from '../server/openai/openai.wiretypes';


export type StreamingClientUpdate = Partial<{
  textSoFar: string;
  typing: boolean;
  originLLM: string;
}>;

/**
 * Client side chat generation, with streaming. This decodes the (text) streaming response from
 * our server streaming endpoint (plain text, not EventSource), and signals updates via a callback.
 *
 * Vendor-specific implementation is on our server backend (API) code. This function tries to be
 * as generic as possible.
 *
 * NOTE: onUpdate is callback when a piece of a message (text, model name, typing..) is received
 */
export async function unifiedStreamingClient<TSourceSetup = unknown, TLLMOptions = unknown>(
  access: ChatStreamingInputSchema['access'],
  llmId: DLLMId,
  llmOptions: TLLMOptions,
  messages: VChatMessageIn[],
  functions: VChatFunctionIn[] | null, forceFunctionName: string | null,
  abortSignal: AbortSignal,
  onUpdate: (update: StreamingClientUpdate, done: boolean) => void,
): Promise<void> {

  // model params (llm)
  const { llmRef, llmTemperature, llmResponseTokens } = (llmOptions as any) || {};
  if (!llmRef || llmTemperature === undefined)
    throw new Error(`Error in configuration for model ${llmId}: ${JSON.stringify(llmOptions)}`);

  // [OpenAI-only] check for harmful content with the free 'moderation' API, if the user requests so
  if (access.dialect === 'openai' && access.moderationCheck) {
    const moderationUpdate = await _openAIModerationCheck(access, messages.at(-1) ?? null);
    if (moderationUpdate)
      return onUpdate({ textSoFar: moderationUpdate, typing: false }, true);
  }

  // prepare the input, similarly to the tRPC openAI.chatGenerate
  const input: ChatStreamingInputSchema = {
    access,
    model: {
      id: llmRef,
      temperature: llmTemperature,
      ...(llmResponseTokens ? { maxTokens: llmResponseTokens } : {}),
    },
    history: messages,
  };

  // connect to the server-side streaming endpoint
  const response = await frontendSideFetch('/api/llms/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: abortSignal,
  });

  if (!response.ok || !response.body) {
    const errorMessage = response.body ? await response.text() : 'No response from server';
    return onUpdate({ textSoFar: errorMessage, typing: false }, true);
  }

  const responseReader = response.body.getReader();
  const textDecoder = new TextDecoder('utf-8');

  // loop forever until the read is done, or the abort controller is triggered
  let incrementalText = '';
  let parsedFirstPacket = false;
  while (true) {
    const { value, done } = await responseReader.read();

    // normal exit condition
    if (done) {
      if (value?.length)
        console.log('unifiedStreamingClient: unexpected value in the last packet:', value?.length);
      break;
    }

    incrementalText += textDecoder.decode(value, { stream: true });

    // (streaming workaround) there may be a JSON object at the beginning of the message,
    // injected by us to transmit the model name
    if (!parsedFirstPacket && incrementalText.startsWith('{')) {
      const endOfJson = incrementalText.indexOf('}');
      if (endOfJson === -1)
        continue;
      const json = incrementalText.substring(0, endOfJson + 1);
      incrementalText = incrementalText.substring(endOfJson + 1);
      parsedFirstPacket = true;
      try {
        const parsed: ChatStreamingFirstOutputPacketSchema = JSON.parse(json);
        onUpdate({ originLLM: parsed.model }, false);
      } catch (e) {
        // error parsing JSON, ignore
        console.log('unifiedStreamingClient: error parsing JSON:', e);
      }
    }

    if (incrementalText)
      onUpdate({ textSoFar: incrementalText }, false);
  }
}


/**
 * OpenAI-specific moderation check. This is a separate function, as it's not part of the
 * streaming chat generation, but it's a pre-check before we even start the streaming.
 *
 * @returns null if the message is safe, or a string with the user message if it's not safe
 */
async function _openAIModerationCheck(access: OpenAIAccessSchema, lastMessage: VChatMessageIn | null): Promise<string | null> {
  if (!lastMessage || lastMessage.role !== 'user')
    return null;

  try {
    const moderationResult: OpenAIWire.Moderation.Response = await apiAsync.llmOpenAI.moderation.mutate({
      access, text: lastMessage.content,
    });
    const issues = moderationResult.results.reduce((acc, result) => {
      if (result.flagged) {
        Object
          .entries(result.categories)
          .filter(([_, value]) => value)
          .forEach(([key, _]) => acc.add(key));
      }
      return acc;
    }, new Set<string>());

    // if there's any perceived violation, we stop here
    if (issues.size) {
      const categoriesText = [...issues].map(c => `\`${c}\``).join(', ');
      // do not proceed with the streaming request
      return `[Moderation] I an unable to provide a response to your query as it violated the following categories of the OpenAI usage policies: ${categoriesText}.\nFor further explanation please visit https://platform.openai.com/docs/guides/moderation/moderation`;
    }
  } catch (error: any) {
    // as the moderation check was requested, we cannot proceed in case of error
    return '[Issue] There was an error while checking for harmful content. ' + error?.toString();
  }

  // moderation check was successful
  return null;
}
