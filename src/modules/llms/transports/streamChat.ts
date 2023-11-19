import { apiAsync } from '~/common/util/trpc.client';

import type { DLLM, DLLMId } from '../store-llms';
import { findVendorForLlmOrThrow } from '../vendors/vendor.registry';

import type { ChatStreamFirstPacketSchema, ChatStreamInputSchema } from './server/openai/openai.streaming';
import type { OpenAIWire } from './server/openai/openai.wiretypes';
import type { VChatMessageIn, VChatFunctionIn } from './chatGenerate';


/**
 * Client side chat generation, with streaming. This decodes the (text) streaming response from
 * our server streaming endpoint (plain text, not EventSource), and signals updates via a callback.
 *
 * Vendor-specific implementation is on our server backend (API) code. This function tries to be
 * as generic as possible.
 *
 * @param llmId LLM to use
 * @param messages the history of messages to send to the API endpoint
 * @param abortSignal used to initiate a client-side abort of the fetch request to the API endpoint
 * @param onUpdate callback when a piece of a message (text, model name, typing..) is received
 */
export async function streamChat(
  llmId: DLLMId,
  messages: VChatMessageIn[],
  abortSignal: AbortSignal,
  onUpdate: (update: Partial<{ text: string, typing: boolean, originLLM: string }>, done: boolean) => void,
  functions?: VChatFunctionIn[],
): Promise<void | OpenAIWire.ChatCompletion.ResponseFunctionCall> {
  const { llm, vendor } = findVendorForLlmOrThrow(llmId);
  const access = vendor.getAccess(llm._source.setup) as ChatStreamInputSchema['access'];
  return await vendorStreamChat(access, llm, messages, abortSignal, onUpdate, functions);
}


async function vendorStreamChat<TSourceSetup = unknown, TLLMOptions = unknown>(
  access: ChatStreamInputSchema['access'],
  llm: DLLM<TSourceSetup, TLLMOptions>,
  messages: VChatMessageIn[],
  abortSignal: AbortSignal,
  onUpdate: (update: Partial<{ text: string, typing: boolean, originLLM: string }>, done: boolean) => void,
  functions?: VChatFunctionIn[],
): Promise<void | OpenAIWire.ChatCompletion.ResponseFunctionCall> {

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
  const { llmRef, llmTemperature, llmResponseTokens } = (llm.options as any) || {};
  if (!llmRef || llmTemperature === undefined || llmResponseTokens === undefined)
    throw new Error(`Error in configuration for model ${llm.id}: ${JSON.stringify(llm.options)}`);

  // prepare the input, similarly to the tRPC openAI.chatGenerate
  const input: ChatStreamInputSchema = {
    access,
    model: {
      id: llmRef,
      temperature: llmTemperature,
      maxTokens: llmResponseTokens,
    },
    history: messages,
    functions: functions ?? undefined,
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
  const fcall = { 'name': '', 'arguments': '' };
  while (true) {
    const { value, done } = await responseReader.read();

    // normal exit condition
    if (done) break;

    let newText = textDecoder.decode(value, { stream: true });
    //plain & fxn call can be in same packet
    let startOfFxnCall = newText.indexOf('<*j3-.fd@>');
    if (startOfFxnCall !== -1)
      incrementalText += newText.substring(0, startOfFxnCall);
    else
      incrementalText += newText;

    if (newText.includes('<*j3-.fd@>')) {
      // console.log('Parsing fcall...', fcall, newText)
      const splits = newText.substring(startOfFxnCall + 10).split('<*j3-.fd@>');
      const fcallDeltas = splits.filter(s => s.trim().length > 0).map(s => JSON.parse(s));
      // console.log('fcallDeltas', fcallDeltas)
      for (const fcallDelta of fcallDeltas) {
        if (fcallDelta?.name?.length > 0)
          fcall['name'] = fcallDelta?.name;
        if (fcallDelta?.arguments?.length > 0)
          fcall['arguments'] += fcallDelta?.arguments;
      }
    }

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
        const parsed: ChatStreamFirstPacketSchema = JSON.parse(json);
        onUpdate({ originLLM: parsed.model }, false);
      } catch (e) {
        // error parsing JSON, ignore
        console.log('vendorStreamChat: error parsing JSON:', e);
      }
    }

    if (incrementalText)
      onUpdate({ text: incrementalText }, false);
  }
  if (fcall.name.length > 0) {
    console.log('final fcall from vendorStreamChat:', { function_call: { name: fcall.name, arguments: JSON.parse(fcall.arguments) } })
    return {
      function_call: { name: fcall.name, arguments: fcall.arguments },
      role: 'assistant', content: null
    };
  }
}