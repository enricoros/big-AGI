import type { ChatStreamingInputSchema } from '~/modules/llms/server/llm.server.streaming';
import { findServiceAccessOrThrow } from '~/modules/llms/vendors/vendor.helpers';

import type { DChatGenerateMetrics } from '~/common/stores/metrics/metrics.types';
import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DMessageContentFragment } from '~/common/stores/chat/chat.fragments';
import type { DMessageMetadata } from '~/common/stores/chat/chat.message';
import { apiStream } from '~/common/util/trpc.client';
import { findLLMOrThrow } from '~/common/stores/llms/store-llms';
import { getLabsDevMode, getLabsDevNoStreaming } from '~/common/state/store-ux-labs';
import { presentErrorToHumans } from '~/common/util/errorUtils';

// NOTE: pay particular attention to the "import type", as this is importing from the server-side Zod definitions
import type { AixAPI_Access, AixAPI_ContextChatStream, AixAPI_Model, AixAPIChatGenerate_Request } from '../server/api/aix.wiretypes';

import { PartReassembler } from './PartReassembler';


export type StreamingClientUpdate = {
  // interpreted
  typing: boolean;
  metrics: DChatGenerateMetrics;

  // replacers in DMessage
  fragments: DMessageContentFragment[];
  modelName: string;

  // additive to DMessage
  metadata?: DMessageMetadata;
};


export async function aixStreamingChatGenerate<TServiceSettings extends object = {}, TAccess extends ChatStreamingInputSchema['access'] = ChatStreamingInputSchema['access']>(
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
  const llm = findLLMOrThrow(llmId);
  const { transportAccess: aixAccess, serviceSettings, vendor } = findServiceAccessOrThrow<TServiceSettings, TAccess>(llm.sId);

  // Aix Model
  const aixModel = _aixModelFromLLMOptions(llm.options, llmId);

  // Aix Context
  const aixContext = { method: 'chat-stream', name: aixContextName, ref: aixContextRef } as const;

  // [OpenAI-only] check for harmful content with the free 'moderation' API, if the user requests so
  // if (aixAccess.dialect === 'openai' && aixAccess.moderationCheck) {
  //   const moderationUpdate = await _openAIModerationCheck(aixAccess, messages.at(-1) ?? null);
  //   if (moderationUpdate)
  //     return onUpdate({ textSoFar: moderationUpdate, typing: false }, true);
  // }

  // apply any vendor-specific rate limit
  await vendor.rateLimitChatGenerate?.(llm, serviceSettings);

  // Aix Low-Level Chat Generation
  const value = await _aix_LL_ChatGenerateContent(aixAccess, aixModel, aixChatGenerate, aixContext, streaming, abortSignal, onUpdate);

  //
  //
  console.log(value.metrics);

  return value;
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
    fragments: [],
    metrics: {},
    modelName: aixModel.id,
    typing: true,
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
          case 'set-metrics':
            messageAccumulator.metrics = update.metrics;
            break;
          case 'set-model':
            messageAccumulator.modelName = update.name;
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
    if (!(isUserAbort1 || isUserAbort2)) {
      if (process.env.NODE_ENV === 'development')
        console.error('[DEV] Aix streaming Error:', error);
      partReassembler.reassembleTerminateError(presentErrorToHumans(error, true, true) || 'Unknown error');
    } else {
      if (isUserAbort1 !== isUserAbort2)
        partReassembler.reassembleTerminateError(`AbortError mismatch: ${isUserAbort1} !== ${isUserAbort2}`);
      else
        partReassembler.reassembleTerminateUserAbort();
    }
  }

  // add aggregate metrics
  const metrics = messageAccumulator.metrics;
  metrics.T = (metrics.TIn || 0) + (metrics.TOut || 0) + (metrics.TCacheRead || 0) + (metrics.TCacheWrite || 0);
  if (metrics.TOut !== undefined && metrics.dtAll !== undefined && metrics.dtAll > 0)
    metrics.vTOutAll = Math.round(100 * metrics.TOut / (metrics.dtAll / 1000)) / 100;

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

