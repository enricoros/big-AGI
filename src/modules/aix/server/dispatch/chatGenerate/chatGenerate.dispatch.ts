import { ANTHROPIC_API_PATHS, anthropicAccess, anthropicBetaFeatures } from '~/modules/llms/server/anthropic/anthropic.access';
import { OPENAI_API_PATHS, openAIAccess } from '~/modules/llms/server/openai/openai.access';
import { bedrockAccessAsync, bedrockResolveRegion, bedrockURLMantle, bedrockURLRuntime } from '~/modules/llms/server/bedrock/bedrock.access';
import { geminiAccess } from '~/modules/llms/server/gemini/gemini.access';
import { ollamaAccess } from '~/modules/llms/server/ollama/ollama.access';

import { fetchResponseOrTRPCThrow, TRPCFetcherError } from '~/server/trpc/trpc.router.fetchers';

import type { AixAPI_Access, AixAPI_Model, AixAPI_ResumeHandle, AixAPIChatGenerate_Request, AixWire_Particles } from '../../api/aix.wiretypes';
import type { AixDemuxers } from '../stream.demuxers';

import { GeminiWire_API_Generate_Content } from '../wiretypes/gemini.wiretypes';
import { GeminiInteractionsWire_API_Interactions } from '../wiretypes/gemini.interactions.wiretypes';

import { aixAnthropicHostedFeatures, aixToAnthropicMessageCreate } from './adapters/anthropic.messageCreate';
import { aixToBedrockConverse } from './adapters/bedrock.converse';
import { aixToGeminiGenerateContent } from './adapters/gemini.generateContent';
import { aixToGeminiInteractionsCreate } from './adapters/gemini.interactionsCreate';
import { aixToOpenAIChatCompletions } from './adapters/openai.chatCompletions';
import { aixToOpenAIResponses } from './adapters/openai.responsesCreate';
import { aixToXAIResponses } from './adapters/xai.responsesCreate';

import type { IParticleTransmitter } from './parsers/IParticleTransmitter';
import { createAnthropicFileInlineTransform } from './parsers/anthropic.transform-fileInline';
import { createAnthropicMessageParser, createAnthropicMessageParserNS } from './parsers/anthropic.parser';
import { createBedrockConverseParserNS, createBedrockConverseStreamParser } from './parsers/bedrock-converse.parser';
import { createGeminiGenerateContentResponseParser } from './parsers/gemini.parser';
import { createGeminiInteractionsParserSSE } from './parsers/gemini.interactions.parser';
import { createOpenAIChatCompletionsChunkParser, createOpenAIChatCompletionsParserNS } from './parsers/openai.parser';
import { createOpenAIResponseParserNS, createOpenAIResponsesEventParser } from './parsers/openai.responses.parser';


// -- Dispatch types --

export type ChatGenerateDispatch = {
  request: ChatGenerateDispatchRequest;
  /** Used by dialects that need multi-step I/O. The returned response is consumed normally via demuxerFormat/chatGenerateParse */
  customConnect?: (signal: AbortSignal) => Promise<Response>;
  bodyTransform?: AixDemuxers.StreamBodyTransform;
  /** Source of truth for the consumer mode: null = NS */
  demuxerFormat: null | AixDemuxers.StreamDemuxerFormat;
  chatGenerateParse: ChatGenerateParseFunction;
  particleTransform?: ChatGenerateParticleTransformFunction;
};

export type ChatGenerateDispatchRequest =
  | { url: string, headers: HeadersInit, method: 'POST', body: object }
  | { url: string, headers: HeadersInit, method: 'GET' };

export type ChatGenerateParseContext = {
  retriesAvailable: boolean;
};

export type ChatGenerateParseFunction = (partTransmitter: IParticleTransmitter, eventData: string, eventName?: string, context?: ChatGenerateParseContext) => void;

/**
 * 1->1 particle transform applied by the executor to every emitted particle.
 * Return the input for pass-through, or a new particle to replace it.
 * Thrown errors are caught by the executor and fall back to the original particle.
 *
 * Set `csfUnsafe` to true if the transform cannot be performed by CSF (e.g. relies on
 * relies on server-side fetch. The CSF entry point strips these transforms and delegates to the
 * ContentReassembler's transforms instead (which shall operate on the same particles).
 */
export type ChatGenerateParticleTransformFunction = ((particle: AixWire_Particles.ChatGenerateOp) => Promise<AixWire_Particles.ChatGenerateOp>) & { csfUnsafe?: true };


// -- Specialized Implementations -- Core of Server-side AI Vendors abstraction --

/**
 * Specializes to the correct vendor a request for chat generation
 */
export async function createChatGenerateDispatch(access: AixAPI_Access, model: AixAPI_Model, chatGenerate: AixAPIChatGenerate_Request, streaming: boolean, enableResumability: boolean): Promise<ChatGenerateDispatch> {

  const { dialect } = access;
  switch (dialect) {
    case 'anthropic': {

      const hostedFeatures = aixAnthropicHostedFeatures(model, chatGenerate);

      // Build the request body from model + chat parameters
      const anthropicBody = aixToAnthropicMessageCreate(model, chatGenerate, streaming, hostedFeatures);

      // [Anthropic, 2026-02-01] Service-level inference geo routing (e.g. "us")
      if (access.anthropicInferenceGeo)
        anthropicBody.inference_geo = access.anthropicInferenceGeo;

      return {
        request: {
          ...anthropicAccess(access, ANTHROPIC_API_PATHS.messages, hostedFeatures),
          method: 'POST',
          body: anthropicBody,
        },
        demuxerFormat: streaming ? 'fast-sse' : null,
        chatGenerateParse: streaming ? createAnthropicMessageParser() : createAnthropicMessageParserNS(),
        particleTransform: !model.vndAntTransformInlineFiles ? undefined : createAnthropicFileInlineTransform(
          anthropicAccess(access, ANTHROPIC_API_PATHS.files, hostedFeatures),
          model.vndAntTransformInlineFiles === 'inline-file-and-delete',
        ),
      };
    }

    case 'bedrock': {
      switch (model.vndBedrockAPI) {

        // [Bedrock Converse] Bedrock-native API, preferred for Amazon models and useful in others too
        case 'converse': {
          const converseUrl = bedrockURLRuntime(bedrockResolveRegion(access), model.id, 'converse', streaming);
          const converseBody = aixToBedrockConverse(model, chatGenerate);
          return {
            request: {
              ...await bedrockAccessAsync(access, 'POST', converseUrl, converseBody),
              method: 'POST' as const,
              body: converseBody,
            },
            bodyTransform: streaming ? 'aws-eventstream-binary' : null,
            demuxerFormat: streaming ? 'fast-sse' : null,
            chatGenerateParse: streaming ? createBedrockConverseStreamParser() : createBedrockConverseParserNS(),
          };
        }

        // [Bedrock Invoke] Anthropic-native InvokeModel API
        case 'invoke-anthropic':
          const invokeUrl = bedrockURLRuntime(bedrockResolveRegion(access), model.id, 'invoke', streaming);

          // body
          const bedrockHostedFeatures = aixAnthropicHostedFeatures(model, chatGenerate);
          const bedrockAnthropicBody: Record<string, any> = aixToAnthropicMessageCreate(model, chatGenerate, streaming, bedrockHostedFeatures);
          delete bedrockAnthropicBody.model; // model in path
          delete bedrockAnthropicBody.stream; // streaming behavior in path
          // headers['anthropic-version'] -> body
          bedrockAnthropicBody.anthropic_version = 'bedrock-2023-05-31';
          // headers['anthropic-beta'] -> body (note: model.id won't match PER_MODEL keys, and that's fine)
          bedrockAnthropicBody.anthropic_beta = anthropicBetaFeatures(bedrockHostedFeatures);
          if (!bedrockAnthropicBody.anthropic_beta?.length)
            delete bedrockAnthropicBody.anthropic_beta;

          return {
            request: {
              ...await bedrockAccessAsync(access, 'POST', invokeUrl, bedrockAnthropicBody),
              method: 'POST',
              body: bedrockAnthropicBody,
            },
            bodyTransform: streaming ? 'aws-eventstream-binary' : null,
            demuxerFormat: streaming ? 'fast-sse' : null,
            chatGenerateParse: streaming ? createAnthropicMessageParser() : createAnthropicMessageParserNS(),
          };

        // [Bedrock Mantle] OpenAI Chat Completions-compatible API for non-Anthropic models
        case 'mantle':
          const mantleUrl = bedrockURLMantle(bedrockResolveRegion(access), '/v1/chat/completions');
          const mantleBody = aixToOpenAIChatCompletions('openai', model, chatGenerate, streaming);
          return {
            request: {
              ...await bedrockAccessAsync(access, 'POST', mantleUrl, mantleBody),
              method: 'POST',
              body: mantleBody,
            },
            demuxerFormat: streaming ? 'fast-sse' : null,
            chatGenerateParse: streaming ? createOpenAIChatCompletionsChunkParser() : createOpenAIChatCompletionsParserNS(),
          };

        default:
          const _exhaustiveCheck: never = model.vndBedrockAPI;
        // fallthrough, then throw
        case undefined:
          break;
      }
      throw new Error(`Unsupported '${model.vndBedrockAPI}' API.`);
    }

    case 'gemini':
      const requestedModelName = model.id.replace('models/', '');

      // [Gemini Interactions API - ALPHA TEST] SSE-native: POST with stream=true, upstream returns event-stream we pipe through the fast-sse demuxer.
      if (model.vndGeminiAPI === 'interactions-agent') {
        if (!streaming) console.warn(`[DEV] Gemini Interactions API - only supported in SSE mode, ignoring streaming=false for model ${model.id}`);
        const request: ChatGenerateDispatchRequest = {
          ...geminiAccess(access, null, GeminiInteractionsWire_API_Interactions.postPath, false),
          method: 'POST',
          body: aixToGeminiInteractionsCreate(model, chatGenerate),
        };
        return {
          request,
          // Custom-connect so we can neutralize the outer retrier on HTTP errors: a retried POST would create a second (billable) Deep Research interaction upstream
          customConnect: (signal) => fetchResponseOrTRPCThrow({ ...request, signal, name: 'Aix.Gemini.Interactions.create', throwWithoutName: true })
            .catch((error: any) => {
              if (signal.aborted) throw error; // preserve abort identity for the executor's abort classifier
              throw new Error(`Gemini Interactions POST: ${error?.message || 'upstream error'}`); // rewrapping TRPCFetcherError as plain Error makes the retrier treat it as non-retryable
            }),
          /** Upstream hardcodes stream=true + background=true (required by deep-research agents) and has no non-streaming alternative. */
          demuxerFormat: 'fast-sse',
          chatGenerateParse: createGeminiInteractionsParserSSE(requestedModelName),
        };
      }

      const useV1Alpha = false; // !!model.vndGeminiShowThoughts || model.vndGeminiThinkingBudget !== undefined;
      return {
        request: {
          ...geminiAccess(access, model.id, streaming ? GeminiWire_API_Generate_Content.streamingPostPath : GeminiWire_API_Generate_Content.postPath, useV1Alpha),
          method: 'POST',
          body: aixToGeminiGenerateContent(model, chatGenerate, access.minSafetyLevel, false, streaming),
        },
        // we verified that 'fast-sse' works well with Gemini
        demuxerFormat: streaming ? 'fast-sse' : null,
        chatGenerateParse: createGeminiGenerateContentResponseParser(requestedModelName, streaming),
      };

    /**
     * Ollama has now an OpenAI compatibility layer for `chatGenerate` API, but still its own protocol for models listing.
     * - as such, we 'cast' here to the dispatch to an OpenAI dispatch, while using Ollama access
     * - we still use the ollama.router for the models listing and administration APIs
     *
     * For reference we show the old code for body/demuxerFormat/chatGenerateParse also below
     */
    case 'ollama':
      return {
        request: {
          ...ollamaAccess(access, OPENAI_API_PATHS.chatCompletions), // use the OpenAI-compatible endpoint
          method: 'POST',
          // body: ollamaChatCompletionPayload(model, _hist, streaming),
          body: aixToOpenAIChatCompletions('openai', model, chatGenerate, streaming),
        },
        // demuxerFormat: streaming ? 'json-nl' : null,
        demuxerFormat: streaming ? 'fast-sse' : null,
        // chatGenerateParse: createDispatchParserOllama(),
        chatGenerateParse: streaming ? createOpenAIChatCompletionsChunkParser() : createOpenAIChatCompletionsParserNS(),
      };

    default:
      const _exhaustiveCheck: never = dialect;
    // fallthrough
    case 'alibaba':
    case 'azure':
    case 'deepseek':
    case 'groq':
    case 'lmstudio':
    case 'localai':
    case 'mistral':
    case 'moonshot':
    case 'openai':
    case 'openpipe':
    case 'openrouter':
    case 'perplexity':
    case 'togetherai':
    case 'xai':
    case 'zai':

      // newer: OpenAI Responses API, for models that support it and all XAI models
      const isResponsesAPI = !!model.vndOaiResponsesAPI;
      const isXAIModel = dialect === 'xai'; // All XAI models are accessed via Responses now
      if (isResponsesAPI || isXAIModel) {
        return {
          request: {
            ...openAIAccess(access, model.id, OPENAI_API_PATHS.responses),
            method: 'POST',
            /**
             * xAI uses its own Responses API adapter.
             *
             * Key differences from OpenAI Responses API:
             * - No 'instructions' field - system content prepended to first user message
             * - xAI-native tools: web_search, x_search, code_execution
             * - Tool calls come in single chunks
             *
             * Note: Response format is compatible with OpenAI parser.
             */
            body: isXAIModel ? aixToXAIResponses(model, chatGenerate, streaming, enableResumability)
              : aixToOpenAIResponses(dialect, model, chatGenerate, streaming, enableResumability),
          },
          demuxerFormat: streaming ? 'fast-sse' : null,
          chatGenerateParse: streaming ? createOpenAIResponsesEventParser() : createOpenAIResponseParserNS(),
        };
      }

      // default: industry-standard OpenAI ChatCompletions API with per-dialect extensions
      const chatCompletionsBody = aixToOpenAIChatCompletions(dialect, model, chatGenerate, streaming);

      // [OpenRouter] Service-level provider routing parameter
      if (dialect === 'openrouter' && access.orRequireParameters)
        chatCompletionsBody.provider = { ...chatCompletionsBody.provider, require_parameters: true };

      return {
        request: {
          ...openAIAccess(access, model.id, OPENAI_API_PATHS.chatCompletions),
          method: 'POST',
          body: chatCompletionsBody,
        },
        demuxerFormat: streaming ? 'fast-sse' : null,
        chatGenerateParse: streaming ? createOpenAIChatCompletionsChunkParser() : createOpenAIChatCompletionsParserNS(),
      };

  }
}


/**
 * Specializes to the correct vendor a request for reattaching to an in-progress upstream run.
 * - OpenAI Responses API: GET /v1/responses/{id} to resume streaming from a response id
 * - Gemini Interactions API: GET-poll /v1beta/interactions/{id} to resume a Deep Research run
 */
export async function createChatGenerateResumeDispatch(access: AixAPI_Access, resumeHandle: AixAPI_ResumeHandle, streaming: boolean): Promise<ChatGenerateDispatch> {

  const { dialect } = access;
  switch (dialect) {
    case 'azure':
    case 'openai':
    case 'openrouter':

      // ASSUME the OpenAI Responses API - https://platform.openai.com/docs/api-reference/responses/get
      if (resumeHandle.uht !== 'vnd.oai.responses')
        throw new Error(`Resume handle mismatch for ${dialect}: expected 'vnd.oai.responses', got '${resumeHandle.uht}'`);
      const { url, headers } = openAIAccess(access, '', `${OPENAI_API_PATHS.responses}/${resumeHandle.runId /* OpenAI response.id */}`);
      const queryParams = new URLSearchParams({
        stream: streaming ? 'true' : 'false',
        ...(!!resumeHandle.startingAfter && { starting_after: resumeHandle.startingAfter.toString() }),
        // include_obfuscation: ...
      });

      return {
        request: { url: `${url}?${queryParams.toString()}`, method: 'GET', headers },
        demuxerFormat: streaming ? 'fast-sse' : null,
        chatGenerateParse: streaming ? createOpenAIResponsesEventParser() : createOpenAIResponseParserNS(),
      };

    case 'gemini': {
      // [Gemini Interactions] Reattach via SSE stream - GET /interactions/{id}?stream=true replays all events from the start (intentional - client's ContentReassembler replaces message content on reattach; partial resume via last_event_id is deliberately NOT used).
      if (resumeHandle.uht !== 'vnd.gem.interactions')
        throw new Error(`Resume handle mismatch for gemini: expected 'vnd.gem.interactions', got '${resumeHandle.uht}'`);
      if (!streaming) console.warn(`[DEV] Gemini Interactions API - Resume only supported in SSE mode, ignoring streaming=false for ${resumeHandle.runId}`);
      const { url: _baseUrl, headers: _headers } = geminiAccess(access, null, GeminiInteractionsWire_API_Interactions.getPath(resumeHandle.runId /* Gemini interaction.id */), false);
      return {
        request: { url: `${_baseUrl}${_baseUrl.includes('?') ? '&' : '?'}stream=true`, method: 'GET', headers: _headers },
        /** Again, only support SSE here, for now (see comment in `createChatGenerateDispatch`) */
        demuxerFormat: 'fast-sse',
        chatGenerateParse: createGeminiInteractionsParserSSE(null /* model name unknown at resume time - caller's DMessage already has it */),
      };
    }

    default:
      const _exhaustiveCheck: never = dialect;
    // fallthrough
    case 'alibaba':
    case 'anthropic':
    case 'bedrock':
    case 'deepseek':
    case 'groq':
    case 'lmstudio':
    case 'localai':
    case 'mistral':
    case 'moonshot':
    case 'ollama':
    case 'openpipe':
    case 'perplexity':
    case 'togetherai':
    case 'xai':
    case 'zai':
      // Throw on unsupported protocols (Azure and OpenRouter are speculatively supported)
      throw new Error(`Resume not supported for dialect: ${dialect}`);

  }
}


// -- Delete Upstream Handle --

export type ChatGenerateDeleteResult = {
  ok: boolean; // server-side acknowledged removal (2xx or 404-already-gone)
  httpStatus?: number;
  message?: string; // optional detail, typically present on failure
};

/**
 * Delete an upstream-stored run by handle. One-shot DELETE, no streaming, no parser.
 * Symmetric to `createChatGenerateResumeDispatch` but terminal: removes the server-side
 * resource so no future reattach is possible.
 *
 * Policy:
 * - 2xx -> ok: true
 * - 404 -> ok: true (already gone upstream; caller should clear the local handle)
 * - everything else -> ok: false with status/message for the caller to render
 * - abort passes through as a thrown AbortError/TRPCFetcherError
 *
 * NOTE on provider semantics (observed 2026-04-23):
 * - Gemini: returns 200 for any valid-shaped interaction id, whether it actually existed or not.
 *   So `ok: true` here means "the handle is now terminal for reattach purposes", NOT "we proved
 *   a deletion happened". Fine for our UX contract (button disappears, reattach will fail).
 * - OpenAI Responses: TBA
 * - Don't surface a "deleted successfully" message to users based on `ok` alone - it'd overclaim.
 */
export async function executeChatGenerateDelete(access: AixAPI_Access, handle: AixAPI_ResumeHandle, abortSignal: AbortSignal): Promise<ChatGenerateDeleteResult> {
  const { dialect } = access;

  let url: string;
  let headers: HeadersInit;
  let name: string;

  switch (dialect) {
    case 'gemini':
      if (handle.uht !== 'vnd.gem.interactions')
        throw new Error(`Delete handle mismatch for gemini: expected 'vnd.gem.interactions', got '${handle.uht}'`);

      // Gemini: cancel the background run first (stops token generation), then DELETE the stored record.
      // The DELETE endpoint only removes the resource; it does NOT cancel an in-flight run.
      // Cancel may 404 "Method not found" on the Developer API (API-key mode, googleapis/python-genai#1971) -
      // we log the outcome and proceed to DELETE so local cleanup still happens.
      const { url: cancelUrl, headers: cancelHeaders } = geminiAccess(access, null, GeminiInteractionsWire_API_Interactions.cancelPath(handle.runId), false);
      try {
        const cancelResp = await fetchResponseOrTRPCThrow({ url: cancelUrl, method: 'POST', body: {}, headers: cancelHeaders, signal: abortSignal, name: 'Aix.Gemini.Interactions.cancel', throwWithoutName: true });
        console.log(`[AIX] Gemini.Interactions.cancel: ok=${cancelResp.ok} status=${cancelResp.status}`);
      } catch (error: any) {
        if (abortSignal.aborted) throw error;
        const status = error instanceof TRPCFetcherError ? error.httpStatus : undefined;
        console.log(`[AIX] Gemini.Interactions.cancel: failed status=${status ?? '?'} msg=${error?.message ?? 'unknown'}`);
      }

      ({ url, headers } = geminiAccess(access, null, GeminiInteractionsWire_API_Interactions.deletePath(handle.runId), false));
      name = 'Aix.Gemini.Interactions.delete';
      break;

    case 'azure':
    case 'openai':
    case 'openrouter':
      if (handle.uht !== 'vnd.oai.responses')
        throw new Error(`Delete handle mismatch for ${dialect}: expected 'vnd.oai.responses', got '${handle.uht}'`);
      ({ url, headers } = openAIAccess(access, '', `${OPENAI_API_PATHS.responses}/${handle.runId}`));
      name = `Aix.${dialect}.Responses.delete`;
      break;

    default:
      throw new Error(`Delete not supported for dialect '${dialect}'`);
  }

  try {
    const response = await fetchResponseOrTRPCThrow({ url, method: 'DELETE', headers, signal: abortSignal, name, throwWithoutName: true });
    return { ok: response.ok, httpStatus: response.status };
  } catch (error: any) {
    if (abortSignal.aborted) throw error; // let the caller handle abort
    // 404 = already removed upstream; treat as success so the client clears its handle
    if (error instanceof TRPCFetcherError && error.httpStatus === 404)
      return { ok: true, httpStatus: 404, message: 'Already removed upstream' };
    return {
      ok: false,
      httpStatus: error instanceof TRPCFetcherError ? error.httpStatus : undefined,
      message: error?.message || 'Delete failed',
    };
  }
}
