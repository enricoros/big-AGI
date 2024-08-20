import type { ChatStreamingInputSchema } from '~/modules/llms/server/llm.server.streaming';
import { findServiceAccessOrThrow } from '~/modules/llms/vendors/vendor.helpers';

import type { DChatGenerateMetrics } from '~/common/stores/metrics/metrics.types';
import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DMessageContentFragment } from '~/common/stores/chat/chat.fragments';
import type { DMessageMetadata } from '~/common/stores/chat/chat.message';
import { apiStream } from '~/common/util/trpc.client';
import { findLLMOrThrow } from '~/common/stores/llms/store-llms';
import { getLabsDevMode, getLabsDevNoStreaming } from '~/common/state/store-ux-labs';
import { metricsStoreAddChatGenerate } from '~/common/stores/metrics/store-metrics';
import { presentErrorToHumans } from '~/common/util/errorUtils';

// NOTE: pay particular attention to the "import type", as this is importing from the server-side Zod definitions
import type { AixAPI_Access, AixAPI_ContextChatStream, AixAPI_Model, AixAPIChatGenerate_Request } from '../server/api/aix.wiretypes';

import { PartReassembler } from './PartReassembler';


export type GenerateContentInterim = {
  // interpreted
  typing: boolean;
  metrics: DChatGenerateMetrics;

  // replacers in DMessage
  fragments: DMessageContentFragment[];
  modelName: string;

  // additive to DMessage
  metadata?: DMessageMetadata;
};

export type GenerateContentFinal = GenerateContentInterim & {
  typing: false;
};


export function aixCreateContext(name: AixAPI_ContextChatStream['name'], ref: AixAPI_ContextChatStream['ref']): AixAPI_ContextChatStream {
  return { method: 'chat-stream', name, ref };
}


export async function aixLLMChatGenerateContent<TServiceSettings extends object = {}, TAccess extends ChatStreamingInputSchema['access'] = ChatStreamingInputSchema['access']>(
  llmId: DLLMId,
  aixChatGenerate: AixAPIChatGenerate_Request,
  aixContext: AixAPI_ContextChatStream,
  // other
  streaming: boolean,
  aixAbortSignal: AbortSignal,
  onStreamingUpdate?: (update: GenerateContentInterim, done: boolean) => void,
): Promise<GenerateContentFinal> {

  // Aix Access
  const llm = findLLMOrThrow(llmId);
  const { transportAccess: aixAccess, serviceSettings, vendor } = findServiceAccessOrThrow<TServiceSettings, TAccess>(llm.sId);

  // [OpenAI-only] check for harmful content with the free 'moderation' API, if the user requests so
  // if (aixAccess.dialect === 'openai' && aixAccess.moderationCheck) {
  //   const moderationUpdate = await _openAIModerationCheck(aixAccess, messages.at(-1) ?? null);
  //   if (moderationUpdate)
  //     return onUpdate({ textSoFar: moderationUpdate, typing: false }, true);
  // }

  // apply any vendor-specific rate limit
  await vendor.rateLimitChatGenerate?.(llm, serviceSettings);

  // Aix Model
  const aixModel = _aixModelFromLLMOptions(llm.options, llmId);

  // Aix Low-Level Chat Generation
  const value = await _aix_LL_ChatGenerateContent(aixAccess, aixModel, aixChatGenerate, aixContext, streaming, aixAbortSignal, onStreamingUpdate);

  // TODO: compute costs here, from the metrics (value.metrics: DChatGenerateMetrics) and the pricing (llm.pricing: DModelPricing)
  metricsStoreAddChatGenerate(value.metrics, llm.pricing?.chat);

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
  aixStreaming: boolean,
  // others
  abortSignal: AbortSignal,
  // optional streaming callback
  onStreamingUpdate?: (update: GenerateContentInterim, done: boolean) => void,
): Promise<GenerateContentFinal> {


  let messageAccumulator: GenerateContentInterim = {
    fragments: [],
    metrics: {},
    modelName: aixModel.id,
    typing: true,
    // metadata: not set because additive and overwriting when set
  };

  const partReassembler = new PartReassembler();

  const particles = await apiStream.aix.chatGenerateContent.mutate({
    access: aixAccess,
    model: aixModel,
    chatGenerate: aixChatGenerate,
    context: aixContext,
    streaming: getLabsDevNoStreaming() ? false : aixStreaming, // [DEV] disable streaming if set in the UX (testing)
    connectionOptions: getLabsDevMode() ? { debugDispatchRequestbody: true } : undefined,
  }, {
    signal: abortSignal,
  });

  try {
    for await (const particle of particles) {
      console.log('update', particle);

      // reassemble the particles to fragments[]
      partReassembler.reassembleParticle(particle);
      messageAccumulator = {
        ...messageAccumulator,
        fragments: [...partReassembler.reassembedFragments],
      };

      if ('cg' in particle) {
        switch (particle.cg) {
          case 'end':
            // NOTE: do something with particle.reason?
            // handle the stop reason
            switch (particle.tokenStopReason) {
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
            messageAccumulator.metrics = particle.metrics;
            break;
          case 'set-model':
            messageAccumulator.modelName = particle.name;
            break;
        }
      }

      // send the streaming particle
      onStreamingUpdate?.(messageAccumulator, false);
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
  const finalMessage: GenerateContentFinal = {
    ...messageAccumulator,
    fragments: [...partReassembler.reassembedFragments],
    typing: false,
  };

  // streaming update
  onStreamingUpdate?.(finalMessage, true);

  // return the final accumulated message
  return finalMessage;
}

// Future Testing Code
//
// const sampleFC: boolean = false; // aixModel.id.indexOf('models/gemini') === -1;
// const sampleCE: boolean = false; // aixModel.id.indexOf('models/gemini') !== -1;
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
// if (sampleCE) {
//   aixChatGenerate.tools = [
//     {
//       type: 'code_execution',
//       variant: 'gemini_auto_inline',
//     },
//   ];
// }