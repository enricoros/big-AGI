import type { ChatStreamingInputSchema } from '~/modules/llms/server/llm.server.streaming';
import type { DLLMId } from '~/modules/llms/store-llms';
import { findVendorForLlmOrThrow } from '~/modules/llms/vendors/vendors.registry';

import type { DMessageContentFragment } from '~/common/stores/chat/chat.fragments';
import type { DMessageMetadata } from '~/common/stores/chat/chat.message';
import { apiStream } from '~/common/util/trpc.client';
import { getLabsDevMode, getLabsDevNoStreaming } from '~/common/state/store-ux-labs';

// NOTE: pay particular attention to the "import type", as this is importing from the server-side Zod definitions
import type { AixAPI_Access, AixAPI_ContextChatStream, AixAPI_Model, AixAPIChatGenerate_Request } from '../server/api/aix.wiretypes';

import { PartReassembler } from './PartReassembler';


export type StreamingClientUpdate = {
  // interpreted
  typing: boolean;
  stats?: {
    chatIn?: number,
    chatOut?: number,
    chatOutRate?: number,
    chatTimeInner?: number,
  };

  // replacers in DMessage
  fragments: DMessageContentFragment[];
  originLLM: string;

  // additive to DMessage
  metadata?: DMessageMetadata;
};


export async function aixStreamingChatGenerate<TSourceSetup = unknown, TAccess extends ChatStreamingInputSchema['access'] = ChatStreamingInputSchema['access']>(
  llmId: DLLMId,
  aixChatGenerate: AixAPIChatGenerate_Request,
  aixContextName: AixAPI_ContextChatStream['name'],
  aixContextRef: string, // AixAPI_ContextChatStream['ref'],
  // other
  streaming: boolean,
  abortSignal: AbortSignal,
  onUpdate?: (update: StreamingClientUpdate, done: boolean) => void,
): Promise<StreamingClientUpdate> {

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
  return await _aix_LL_ChatGenerateContent(aixAccess, aixModel, aixChatGenerate, aixContext, streaming, abortSignal, onUpdate);
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
async function _aix_LL_ChatGenerateContent(
  // aix inputs
  aixAccess: AixAPI_Access,
  aixModel: AixAPI_Model,
  aixChatGenerate: AixAPIChatGenerate_Request,
  aixContext: AixAPI_ContextChatStream,
  // others
  streaming: boolean,
  abortSignal: AbortSignal,
  // TODO: improve onUpdate to have a better signature
  onUpdate?: (update: StreamingClientUpdate, done: boolean) => void,
): Promise<StreamingClientUpdate> {

  // const sampleFC: boolean = false; // aixModel.id.indexOf('models/gemini') === -1;
  const sampleCE: boolean = false; // aixModel.id.indexOf('models/gemini') !== -1;

  // if (sampleFC) {
  //   aixChatGenerate.tools = [
  //     {
  //       type: 'function_call',
  //       function_call: {
  //         name: 'get_capybara_info_given_name_and_color',
  //         description: 'Get the info about capybaras. Call one each per name.',
  //         input_schema: {
  //           properties: {
  //             'name': {
  //               type: 'string',
  //               description: 'The name of the capybara',
  //               enum: ['enrico', 'coolio'],
  //             },
  //             'color': {
  //               type: 'string',
  //               description: 'The color of the capybara. Mandatory!!',
  //             },
  //             // 'story': {
  //             //   type: 'string',
  //             //   description: 'A fantastic story about the capybara. Please 10 characters maximum.',
  //             // },
  //           },
  //           required: ['name'],
  //         },
  //       },
  //     },
  //   ];
  // }
  if (sampleCE) {
    aixChatGenerate.tools = [
      {
        type: 'code_execution',
        variant: 'gemini_auto_inline',
      },
    ];
  }

  if (getLabsDevNoStreaming())
    streaming = false;
  const operation = await apiStream.aix.chatGenerateContent.mutate(
    { access: aixAccess, model: aixModel, chatGenerate: aixChatGenerate, context: aixContext, streaming, connectionOptions: getLabsDevMode() ? { debugDispatchRequestbody: true } : undefined },
    { signal: abortSignal },
  );


  let messageAccumulator: StreamingClientUpdate = {
    typing: true,
    // stats: not added until we have it
    fragments: [],
    originLLM: aixModel.id,
    // metadata: not set because additive and overwriting when set
  };

  const partReassembler = new PartReassembler();

  try {
    for await (const update of operation) {
      console.log('update', update);

      // reassemble the particles to fragments[]
      partReassembler.reassembleParticle(update);
      messageAccumulator = {
        ...messageAccumulator,
        fragments: [...partReassembler.reassembedFragments],
      };

      if ('cg' in update) {
        switch (update.cg) {
          case 'end':
            // NOTE: do something with update.reason?
            // handle the stop reason
            switch (update.tokenStopReason) {
              case 'out-of-tokens':
                messageAccumulator.metadata = {
                  ...messageAccumulator.metadata,
                  ranOutOfTokens: true,
                };
                break;
              case 'cg-issue':              // error fragment already added before
              case 'filter-content':        // inline text message shall have been added
              case 'filter-recitation':     // inline text message shall have been added
              case 'ok':                    // content
              case 'ok-tool_invocations':   // content + tool invocation
                break;
            }
            break;

          case 'set-model':
            messageAccumulator.originLLM = update.name;
            break;

          case 'update-counts':
            messageAccumulator.stats = update.counts;
            break;
        }
      }

      // send the streaming update
      onUpdate?.(messageAccumulator, false);
    }
  } catch (error: any) {
    // something else broke, likely a User Abort, or an Aix server error (e.g. tRPC)
    const isUserAbort1 = abortSignal.aborted;
    const isUserAbort2 = (error instanceof Error) && (error.name === 'AbortError' || (error.cause instanceof DOMException && error.cause.name === 'AbortError'));
    if (isUserAbort1 || isUserAbort2) {
      if (isUserAbort1 !== isUserAbort2)
        partReassembler.reassembleTerminateError(`AbortError mismatch: ${isUserAbort1} !== ${isUserAbort2}`);
      else
        partReassembler.reassembleTerminateUserAbort();
    } else
      partReassembler.reassembleTerminateError(_safeStringify(error) || error?.message || 'Unknown connection error');
  }

  // and we're done
  messageAccumulator = {
    ...messageAccumulator,
    fragments: [...partReassembler.reassembedFragments],
    typing: false,
  };

  // streaming update
  onUpdate?.(messageAccumulator, true);

  // return the final accumulated message
  return messageAccumulator;
}


function _safeStringify(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return null;
  }
}
