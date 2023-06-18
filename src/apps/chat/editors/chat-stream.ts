import { ChatGenerateSchema } from '~/modules/llms/openai/openai.router';
import { DLLMId } from '~/modules/llms/llm.types';
import { LLMOptionsOpenAI, normalizeOAISetup, SourceSetupOpenAI } from '~/modules/llms/openai/openai.vendor';
import { OpenAI } from '~/modules/llms/openai/openai.types';
import { SystemPurposeId } from '../../../data';
import { apiAsync } from '~/modules/trpc/trpc.client';
import { autoTitle } from '~/modules/aifn/autotitle/autoTitle';
import { findLLMOrThrow } from '~/modules/llms/store-llms';
import { speakText } from '~/modules/elevenlabs/elevenlabs.client';
import { useElevenlabsStore } from '~/modules/elevenlabs/store-elevenlabs';

import { DMessage, useChatStore } from '~/common/state/store-chats';

import { createAssistantTypingMessage, updatePurposeInHistory } from './editors';


/**
 * The main "chat" function. TODO: this is here so we can soon move it to the data model.
 */
export async function runAssistantUpdatingState(conversationId: string, history: DMessage[], assistantLlmId: DLLMId, systemPurpose: SystemPurposeId) {

  // update the system message from the active Purpose, if not manually edited
  history = updatePurposeInHistory(conversationId, history, systemPurpose);

  // create a blank and 'typing' message for the assistant
  const assistantMessageId = createAssistantTypingMessage(conversationId, assistantLlmId, history[0].purposeId, '...');

  // when an abort controller is set, the UI switches to the "stop" mode
  const controller = new AbortController();
  const { startTyping, editMessage } = useChatStore.getState();
  startTyping(conversationId, controller);

  await streamAssistantMessage(conversationId, assistantMessageId, history, assistantLlmId, editMessage, controller.signal);

  // clear to send, again
  startTyping(conversationId, null);

  // update text, if needed
  await autoTitle(conversationId);
}


async function streamAssistantMessage(
  conversationId: string, assistantMessageId: string,
  history: DMessage[],
  llmId: DLLMId,
  editMessage: (conversationId: string, messageId: string, updatedMessage: Partial<DMessage>, touch: boolean) => void,
  abortSignal: AbortSignal,
) {

  // access params
  const llm = findLLMOrThrow(llmId);
  const oaiSetup: Partial<SourceSetupOpenAI> = llm._source.setup as Partial<SourceSetupOpenAI>;

  const { llmRef, llmTemperature, llmResponseTokens }: Partial<LLMOptionsOpenAI> = llm.options || {};
  if (!llmRef || llmTemperature === undefined || llmResponseTokens === undefined)
    throw new Error(`Error in openAI configuration for model ${llmId}: ${llm.options}`);

  // our API input
  const input: ChatGenerateSchema = {
    access: normalizeOAISetup(oaiSetup),
    model: {
      id: llmRef,
      temperature: llmTemperature,
      maxTokens: llmResponseTokens,
    },
    history: history.map(({ role, text }) => ({
      role: role,
      content: text,
    })),
  };

  // other params
  const shallSpeakFirstLine = useElevenlabsStore.getState().elevenLabsAutoSpeak === 'firstLine';

  // check for harmful content
  const lastMessage = input.history.at(-1) ?? null;
  const useModeration = input.access.moderationCheck && lastMessage && lastMessage.role === 'user';
  if (useModeration) {
    try {
      const moderationResult: OpenAI.Wire.Moderation.Response = await apiAsync.openai.moderation.mutate({ access: input.access, text: lastMessage.content });

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
        editMessage(
          conversationId,
          assistantMessageId,
          {
            text: `[Moderation] I an unable to provide a response to your query as it violated the following categories of the OpenAI usage policies: ${categoriesText}.\nFor further explanation please visit https://platform.openai.com/docs/guides/moderation/moderation`,
            typing: false,
          },
          false,
        );
        // do not proceed with the streaming request
        return;
      }
    } catch (error: any) {
      editMessage(conversationId, assistantMessageId, { text: `[Issue] There was an error while checking for harmful content. ${error?.toString()}`, typing: false }, false);
      // as the moderation check was requested, we cannot proceed in case of error
      return;
    }
  }

  try {

    const response = await fetch('/api/openai/stream-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: abortSignal,
    });

    if (!response.body) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('No response body');
    }

    const responseReader = response.body.getReader();
    const textDecoder = new TextDecoder('utf-8');

    // loop forever until the read is done, or the abort controller is triggered
    let incrementalText = '';
    let parsedFirstPacket = false;
    let sentFirstParagraph = false;
    while (true) {
      const { value, done } = await responseReader.read();

      if (done) break;

      incrementalText += textDecoder.decode(value, { stream: true });

      // there may be a JSON object at the beginning of the message, which contains the model name (streaming workaround)
      if (!parsedFirstPacket && incrementalText.startsWith('{')) {
        const endOfJson = incrementalText.indexOf('}');
        if (endOfJson > 0) {
          const json = incrementalText.substring(0, endOfJson + 1);
          incrementalText = incrementalText.substring(endOfJson + 1);
          try {
            const parsed: OpenAI.API.Chat.StreamingFirstResponse = JSON.parse(json);
            editMessage(conversationId, assistantMessageId, { originLLM: parsed.model }, false);
            parsedFirstPacket = true;
          } catch (e) {
            // error parsing JSON, ignore
            console.log('Error parsing JSON: ' + e);
          }
        }
      }

      // if the first paragraph (after the first packet) is complete, call the callback
      if (parsedFirstPacket && shallSpeakFirstLine && !sentFirstParagraph) {
        let cutPoint = incrementalText.lastIndexOf('\n');
        if (cutPoint < 0)
          cutPoint = incrementalText.lastIndexOf('. ');
        if (cutPoint > 100 && cutPoint < 400) {
          sentFirstParagraph = true;
          const firstParagraph = incrementalText.substring(0, cutPoint);
          speakText(firstParagraph).then(() => false /* fire and forget, we don't want to stall this loop */);
        }
      }

      editMessage(conversationId, assistantMessageId, { text: incrementalText }, false);
    }

  } catch (error: any) {
    if (error?.name === 'AbortError') {
      // expected, the user clicked the "stop" button
    } else {
      // TODO: show an error to the UI
      console.error('Fetch request error:', error);
    }
  }

  // finally, stop the typing animation
  editMessage(conversationId, assistantMessageId, { typing: false }, false);
}