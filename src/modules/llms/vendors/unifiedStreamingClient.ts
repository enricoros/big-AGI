import { apiAsync } from '~/common/util/trpc.client';

import type { ChatStreamingFirstOutputPacketSchema, ChatStreamingInputSchema } from '../server/llm.server.streaming';
import type { DLLMId } from '../store-llms';
import type { VChatFunctionIn, VChatMessageIn } from '../llm.client';

import type { OpenAIWire } from '../server/openai/openai.wiretypes';


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
  onUpdate: (update: Partial<{ text: string, typing: boolean, originLLM: string }>, done: boolean) => void,
) {

  // [OpenAI-only] check for harmful content with the free 'moderation' API
  if (access.dialect === 'openai') {
    const lastMessage = messages.at(-1) ?? null;
    const useModeration = access.moderationCheck && lastMessage && lastMessage.role === 'user';
    if (useModeration) {
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
          return onUpdate({
            text: `[Moderation] I an unable to provide a response to your query as it violated the following categories of the OpenAI usage policies: ${categoriesText}.\nFor further explanation please visit https://platform.openai.com/docs/guides/moderation/moderation`,
            typing: false,
          }, true);
        }
      } catch (error: any) {
        // as the moderation check was requested, we cannot proceed in case of error
        return onUpdate({
          text: `[Issue] There was an error while checking for harmful content. ${error?.toString()}`,
          typing: false,
        }, true);
      }
    }
  }

  // model params (llm)
  const { llmRef, llmTemperature, llmResponseTokens } = (llmOptions as any) || {};
  if (!llmRef || llmTemperature === undefined)
    throw new Error(`Error in configuration for model ${llmId}: ${JSON.stringify(llmOptions)}`);

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
  const response = await fetch('/api/llms/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: abortSignal,
  });

  if (!response.ok || !response.body) {
    const errorMessage = response.body ? await response.text() : 'No response from server';
    return onUpdate({ text: errorMessage, typing: false }, true);
  }

  const responseReader = response.body.getReader();
  const textDecoder = new TextDecoder('utf-8');

  // loop forever until the read is done, or the abort controller is triggered
  let incrementalText = '';
  let parsedFirstPacket = false;
  while (true) {
    const { value, done } = await responseReader.read();

    // normal exit condition
    if (done) break;

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
        console.log('vendorStreamChat: error parsing JSON:', e);
      }
    }

    if (incrementalText)
      onUpdate({ text: incrementalText }, false);
  }
}