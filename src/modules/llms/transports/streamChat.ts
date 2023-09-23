import { apiAsync } from '~/modules/trpc/trpc.client';

import type { DLLM, DLLMId } from '../store-llms';
import type { IModelVendor } from '../vendors/IModelVendor';
import { findVendorForLlmOrThrow } from '../vendors/vendor.registry';

import type { ChatStreamSchema } from './server/openai.router';
import type { OpenAI } from './server/openai.wiretypes';
import type { VChatMessageIn } from './chatGenerate';

import { ModelVendorAnthropic, SourceSetupAnthropic } from '../vendors/anthropic/anthropic.vendor';
import { ModelVendorOpenAI, SourceSetupOpenAI } from '../vendors/openai/openai.vendor';


/**
 * Chat streaming function on the client side. This decodes the (text) streaming response
 * from the /api/llms/stream endpoint, and signals updates via our callback.
 *
 * Vendor-specific implementation is on the backend (API) code. This function tries to be
 * as generic as possible.
 *
 * @param llmId LLM to use
 * @param chatHistory the history of messages to send to the API endpoint
 * @param abortSignal used to initiate a client-side abort of the fetch request to the API endpoint
 * @param onUpdate callback when a piece of a message (text, model name, typing..) is received
 */
export async function streamChat(
  llmId: DLLMId,
  chatHistory: VChatMessageIn[],
  abortSignal: AbortSignal,
  onUpdate: (update: Partial<{ text: string, typing: boolean, originLLM: string }>, done: boolean) => void,
): Promise<void> {
  const { llm, vendor } = findVendorForLlmOrThrow(llmId);
  return await vendorStreamChat(vendor, llm, chatHistory, abortSignal, onUpdate);
}


async function vendorStreamChat<TSourceSetup = unknown, TLLMOptions = unknown>(
  vendor: IModelVendor<TSourceSetup, TLLMOptions>, llm: DLLM<TLLMOptions>,
  chatHistory: VChatMessageIn[],
  abortSignal: AbortSignal,
  onUpdate: (update: Partial<{ text: string, typing: boolean, originLLM: string }>, done: boolean) => void,
) {

  // access params (source)
  const sourceSetup = vendor.normalizeSetup(llm._source.setup);

  // [OpenAI-only] check for harmful content with the free 'moderation' API
  if (vendor.id === 'openai') {
    const openAISourceSetup = sourceSetup as SourceSetupOpenAI;
    const lastMessage = chatHistory.at(-1) ?? null;
    const useModeration = openAISourceSetup.moderationCheck && lastMessage && lastMessage.role === 'user';
    if (useModeration) {
      try {
        const moderationResult: OpenAI.Wire.Moderation.Response = await apiAsync.llmOpenAI.moderation.mutate({
          access: openAISourceSetup,
          text: lastMessage.content,
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
  const { llmRef, llmTemperature, llmResponseTokens } = (llm.options as any) || {};
  if (!llmRef || llmTemperature === undefined || llmResponseTokens === undefined)
    throw new Error(`Error in openAI configuration for model ${llm.id}: ${llm.options}`);

  // call /api/llms/stream
  const response = await fetch('/api/llms/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // map all to OpenAI, apart from Anthropic
      vendorId: vendor.id === 'anthropic' ? 'anthropic' : 'openai',
      access: vendor.id === 'anthropic'
        ? ModelVendorAnthropic.normalizeSetup(sourceSetup as SourceSetupAnthropic)
        : ModelVendorOpenAI.normalizeSetup(sourceSetup as SourceSetupOpenAI),
      model: {
        id: llmRef,
        temperature: llmTemperature,
        maxTokens: llmResponseTokens,
      },
      functions: undefined,
      history: chatHistory,
    } satisfies ChatStreamSchema),
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
        const parsed: OpenAI.API.Chat.StreamingFirstResponse = JSON.parse(json);
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