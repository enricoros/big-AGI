import { ANTHROPIC_API_PATHS, anthropicAccess, anthropicBetaFeatures } from '~/modules/llms/server/anthropic/anthropic.access';
import { OPENAI_API_PATHS, openAIAccess } from '~/modules/llms/server/openai/openai.access';
import { bedrockAccessAsync, bedrockResolveRegion, bedrockURLMantle, bedrockURLRuntime } from '~/modules/llms/server/bedrock/bedrock.access';
import { geminiAccess } from '~/modules/llms/server/gemini/gemini.access';
import { ollamaAccess } from '~/modules/llms/server/ollama/ollama.access';

import type { AixAPI_Access, AixAPI_Model, AixAPI_ResumeHandle, AixAPIChatGenerate_Request, AixWire_Particles } from '../../api/aix.wiretypes';
import type { AixDemuxers } from '../stream.demuxers';

import { GeminiWire_API_Generate_Content } from '../wiretypes/gemini.wiretypes';

import { aixAnthropicHostedFeatures, aixToAnthropicMessageCreate } from './adapters/anthropic.messageCreate';
import { aixToBedrockConverse } from './adapters/bedrock.converse';
import { aixToGeminiGenerateContent } from './adapters/gemini.generateContent';
import { aixToOpenAIChatCompletions } from './adapters/openai.chatCompletions';
import { aixToOpenAIResponses } from './adapters/openai.responsesCreate';
import { aixToXAIResponses } from './adapters/xai.responsesCreate';

import type { IParticleTransmitter } from './parsers/IParticleTransmitter';
import { createAnthropicFileInlineTransform } from './parsers/anthropic.transform-fileInline';
import { createAnthropicMessageParser, createAnthropicMessageParserNS } from './parsers/anthropic.parser';
import { createBedrockConverseParserNS, createBedrockConverseStreamParser } from './parsers/bedrock-converse.parser';
import { createGeminiGenerateContentResponseParser } from './parsers/gemini.parser';
import { createOpenAIChatCompletionsChunkParser, createOpenAIChatCompletionsParserNS } from './parsers/openai.parser';
import { createOpenAIResponseParserNS, createOpenAIResponsesEventParser } from './parsers/openai.responses.parser';


// -- Dispatch types --

export type ChatGenerateDispatch = {
  request: ChatGenerateDispatchRequest;
  bodyTransform?: AixDemuxers.StreamBodyTransform;
  demuxerFormat: AixDemuxers.StreamDemuxerFormat;
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
 */
export type ChatGenerateParticleTransformFunction = (particle: AixWire_Particles.ChatGenerateOp) => Promise<AixWire_Particles.ChatGenerateOp>;


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
      /**
       * [Gemini, 2025-04-17] For newer thinking parameters, use v1alpha (we only see statistically better results)
       */
      const useV1Alpha = false; // !!model.vndGeminiShowThoughts || model.vndGeminiThinkingBudget !== undefined;
      return {
        request: {
          ...geminiAccess(access, model.id, streaming ? GeminiWire_API_Generate_Content.streamingPostPath : GeminiWire_API_Generate_Content.postPath, useV1Alpha),
          method: 'POST',
          body: aixToGeminiGenerateContent(model, chatGenerate, access.minSafetyLevel, false, streaming),
        },
        // we verified that 'fast-sse' works well with Gemini
        demuxerFormat: streaming ? 'fast-sse' : null,
        chatGenerateParse: createGeminiGenerateContentResponseParser(model.id.replace('models/', ''), streaming),
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
 * Specializes to the correct vendor a request for resuming chat generation (OpenAI Responses API only).
 * Constructs a GET request to retrieve and stream a response by its ID.
 */
export async function createChatGenerateResumeDispatch(access: AixAPI_Access, resumeHandle: AixAPI_ResumeHandle, streaming: boolean): Promise<ChatGenerateDispatch> {

  const { dialect } = access;
  switch (dialect) {
    case 'azure':
    case 'openai':
    case 'openrouter':

      // ASSUME the OpenAI Responses API - https://platform.openai.com/docs/api-reference/responses/get
      const { url, headers } = openAIAccess(access, '', `${OPENAI_API_PATHS.responses}/${resumeHandle.responseId}`);
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

    default:
      const _exhaustiveCheck: never = dialect;
    // fallthrough
    case 'alibaba':
    case 'anthropic':
    case 'bedrock':
    case 'deepseek':
    case 'gemini':
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
