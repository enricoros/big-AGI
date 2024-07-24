import type { ChatStreamingInputSchema } from '~/modules/llms/server/llm.server.streaming';
import type { DLLMId } from '~/modules/llms/store-llms';
import { findVendorForLlmOrThrow } from '~/modules/llms/vendors/vendors.registry';

import type { DMessageFragment } from '~/common/stores/chat/chat.fragments';
import { apiStream } from '~/common/util/trpc.client';
import { getLabsDevMode } from '~/common/state/store-ux-labs';

// NOTE: pay particular attention to the "import type", as this is importing from the server-side Zod definitions
import type { AixAPI_Access, AixAPI_ContextChatStream, AixAPI_Model, AixAPIChatGenerate_Request } from '../server/api/aix.wiretypes';

import { PartReassembler } from './PartReassembler';


export type StreamingClientUpdate = Partial<{
  fragments: DMessageFragment[];
  typing: boolean;
  originLLM: string;
}>;


export async function aixStreamingChatGenerate<TSourceSetup = unknown, TAccess extends ChatStreamingInputSchema['access'] = ChatStreamingInputSchema['access']>(
  llmId: DLLMId,
  aixChatGenerate: AixAPIChatGenerate_Request,
  aixContextName: AixAPI_ContextChatStream['name'],
  aixContextRef: AixAPI_ContextChatStream['ref'],
  abortSignal: AbortSignal,
  onUpdate: (update: StreamingClientUpdate, done: boolean) => void,
): Promise<void> {

  // Aix Access
  const { llm, vendor } = findVendorForLlmOrThrow<TSourceSetup, TAccess>(llmId);
  const partialSourceSetup = llm._source.setup;
  const aixAccess = vendor.getTransportAccess(partialSourceSetup);

  // Aix Model - FIXME: relax the forced cast
  // const llmOptions = llm.options;
  const aixModel = _aixModelFromLLMOptions(llm.options, llmId);

  // Aix Context
  const aixContext = { method: 'chat-stream', name: aixContextName, ref: aixContextRef } as const;

  // Simple rate limiting (vendor-specific)
  const delay = vendor.getRateLimitDelay?.(llm, partialSourceSetup) ?? 0;
  if (delay > 0)
    await new Promise(resolve => setTimeout(resolve, delay));

  // [OpenAI-only] check for harmful content with the free 'moderation' API, if the user requests so
  // if (aixAccess.dialect === 'openai' && aixAccess.moderationCheck) {
  //   const moderationUpdate = await _openAIModerationCheck(aixAccess, messages.at(-1) ?? null);
  //   if (moderationUpdate)
  //     return onUpdate({ textSoFar: moderationUpdate, typing: false }, true);
  // }

  // execute via the vendor
  // return await vendor.streamingChatGenerateOrThrow(aixAccess, llmId, llmOptions, messages, contextName, contextRef, functions, forceFunctionName, abortSignal, onUpdate);
  return await _aixChatGenerateContent(aixAccess, aixModel, aixChatGenerate, aixContext, abortSignal, onUpdate);
}


function _aixModelFromLLMOptions(llmOptions: Record<string, any>, debugLlmId: string): AixAPI_Model {
  // model params (llm)
  const { llmRef, llmTemperature, llmResponseTokens } = llmOptions || {};
  if (!llmRef || llmTemperature === undefined)
    throw new Error(`Error in configuration for model ${debugLlmId}: ${JSON.stringify(llmOptions)}`);

  return {
    id: llmRef,
    temperature: llmTemperature,
    ...(llmResponseTokens ? { maxTokens: llmResponseTokens } : {}),
  };
}


export let devMode_AixLastDispatchRequestBody: string | null = null;


// export type DMessageAixIntakeRecombinedPart =
//   | DMessageTextPart
//   | DMessageDocPart
//   | DMessageToolInvocationPart
//   | DMessageToolResponsePart // [Gemini] code execution is a code response, which may come down the pipe
//   | DMessageErrorPart;


/**
 * Client side chat generation, with streaming. This decodes the (text) streaming response from
 * our server streaming endpoint (plain text, not EventSource), and signals updates via a callback.
 *
 * Vendor-specific implementation is on our server backend (API) code. This function tries to be
 * as generic as possible.
 *
 * NOTE: onUpdate is callback when a piece of a message (text, model name, typing..) is received
 */
async function _aixChatGenerateContent(
  // aix inputs
  aixAccess: AixAPI_Access,
  aixModel: AixAPI_Model,
  aixChatGenerate: AixAPIChatGenerate_Request,
  aixContext: AixAPI_ContextChatStream,
  // others
  abortSignal: AbortSignal,
  onUpdate: (update: StreamingClientUpdate, done: boolean) => void,
): Promise<void> {

  const sampleFC: boolean = true;
  const sampleCE: boolean = false;

  if (sampleFC) {
    aixChatGenerate.tools = [
      {
        type: 'function_call',
        function_call: {
          name: 'get_capybara_info_given_name_and_color_very_long',
          description: 'Get the info about capybaras. Call one each per name.',
          input_schema: {
            properties: {
              'name': {
                type: 'string',
                description: 'The name of the capybara',
                enum: ['enrico', 'coolio'],
              },
              'color': {
                type: 'string',
                description: 'The color of the capybara. Mandatory!!',
              },
              // 'story': {
              //   type: 'string',
              //   description: 'A fantastic story about the capybara. Please 10 characters maximum.',
              // },
            },
            required: ['name'],
          },
        },
      },
    ];
  }
  if (sampleCE) {
    aixChatGenerate.tools = [
      {
        type: 'code_execution',
        variant: 'gemini_auto_inline',
      },
    ];
  }


  const operation = await apiStream.aix.chatGenerateContent.mutate(
    { access: aixAccess, model: aixModel, chatGenerate: aixChatGenerate, context: aixContext, streaming: true, connectionOptions: getLabsDevMode() ? { debugDispatchRequestbody: true } : undefined },
    { signal: abortSignal },
  );

  const partReassembler = new PartReassembler();

  try {
    for await (const update of operation) {
      console.log('update', update);
      partReassembler.processParticle(update);

      const fragments = partReassembler.getReassembledFragments();
      console.log('fragments', fragments);
      onUpdate({ fragments: [...fragments], typing: true }, false);

      if ('cg' in update && update.cg === 'set-model') {
        onUpdate({ originLLM: update.name }, false);
      }
    }
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || (error.cause instanceof DOMException && error.cause.name === 'AbortError'))) {
      console.log('Client-side aborted');
    } else {
      console.error('AIX stream generation Client catch:', (error as any).name, { error });
    }
  }

  console.log('HERE', abortSignal.aborted ? 'client-initiated ABORTED' : '');

  onUpdate({ typing: false }, true);
}
