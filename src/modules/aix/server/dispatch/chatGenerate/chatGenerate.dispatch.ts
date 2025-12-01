import { anthropicAccess } from '~/modules/llms/server/anthropic/anthropic.access';
import { geminiAccess } from '~/modules/llms/server/gemini/gemini.access';
import { ollamaAccess } from '~/modules/llms/server/ollama/ollama.access';
import { openAIAccess } from '~/modules/llms/server/openai/openai.access';
// [DeepSeek, 2025-12-01] V3.2-Speciale temporary endpoint
import { DEEPSEEK_SPECIALE_HOST, DEEPSEEK_SPECIALE_SUFFIX } from '~/modules/llms/server/openai/models/deepseek.models';

import type { AixAPI_Access, AixAPI_Model, AixAPI_ResumeHandle, AixAPIChatGenerate_Request } from '../../api/aix.wiretypes';
import type { AixDemuxers } from '../stream.demuxers';

import { GeminiWire_API_Generate_Content } from '../wiretypes/gemini.wiretypes';

import { aixToAnthropicMessageCreate } from './adapters/anthropic.messageCreate';
import { aixToGeminiGenerateContent } from './adapters/gemini.generateContent';
import { aixToOpenAIChatCompletions } from './adapters/openai.chatCompletions';
import { aixToOpenAIResponses } from './adapters/openai.responsesCreate';

import type { IParticleTransmitter } from './parsers/IParticleTransmitter';
import { createAnthropicMessageParser, createAnthropicMessageParserNS } from './parsers/anthropic.parser';
import { createGeminiGenerateContentResponseParser } from './parsers/gemini.parser';
import { createOpenAIChatCompletionsChunkParser, createOpenAIChatCompletionsParserNS } from './parsers/openai.parser';
import { createOpenAIResponseParserNS, createOpenAIResponsesEventParser } from './parsers/openai.responses.parser';


// -- Dispatch types --

export type ChatGenerateDispatch = {
  request: ChatGenerateDispatchRequest;
  demuxerFormat: AixDemuxers.StreamDemuxerFormat;
  chatGenerateParse: ChatGenerateParseFunction;
};

export type ChatGenerateDispatchRequest =
  | { url: string, headers: HeadersInit, method: 'POST', body: object }
  | { url: string, headers: HeadersInit, method: 'GET' };

export type ChatGenerateParseContext = {
  retriesAvailable: boolean;
};

export type ChatGenerateParseFunction = (partTransmitter: IParticleTransmitter, eventData: string, eventName?: string, context?: ChatGenerateParseContext) => void;


// -- Specialized Implementations -- Core of Server-side AI Vendors abstraction --

/**
 * Specializes to the correct vendor a request for chat generation
 */
export function createChatGenerateDispatch(access: AixAPI_Access, model: AixAPI_Model, chatGenerate: AixAPIChatGenerate_Request, streaming: boolean, enableResumability: boolean): ChatGenerateDispatch {

  const { dialect } = access;
  switch (dialect) {
    case 'anthropic': {

      // [Anthropic, 2025-11-24] Detect if any tool uses Programmatic Tool Calling features (allowed_callers, input_examples)
      const usesProgrammaticToolCalling = chatGenerate.tools?.some(tool =>
          tool.type === 'function_call' && (
            tool.function_call.allowed_callers?.includes('code_execution') ||
            (tool.function_call.input_examples && tool.function_call.input_examples.length > 0)
          ),
      ) ?? false;

      const anthropicRequest = anthropicAccess(access, '/v1/messages', {
        modelIdForBetaFeatures: model.id,
        vndAntWebFetch: model.vndAntWebFetch === 'auto',
        vndAnt1MContext: model.vndAnt1MContext === true,
        vndAntEffort: !!model.vndAntEffort,
        enableSkills: !!model.vndAntSkills,
        enableStrictOutputs: !!model.strictJsonOutput || !!model.strictToolInvocations, // [Anthropic, 2025-11-13] for both JSON output and grammar-constrained tool invocations inputs
        enableToolSearch: !!model.vndAntToolSearch,
        enableProgrammaticToolCalling: usesProgrammaticToolCalling,
        // enableCodeExecution: ...
      });

      return {
        request: {
          ...anthropicRequest,
          method: 'POST',
          body: aixToAnthropicMessageCreate(model, chatGenerate, streaming),
        },
        demuxerFormat: streaming ? 'fast-sse' : null,
        chatGenerateParse: streaming ? createAnthropicMessageParser() : createAnthropicMessageParserNS(),
      };
    }

    case 'gemini':
      /**
       * [Gemini, 2025-04-17] For newer thinking parameters, use v1alpha (we only see statistically better results)
       */
      const useV1Alpha = !!model.vndGeminiShowThoughts || model.vndGeminiThinkingBudget !== undefined;
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
          ...ollamaAccess(access, '/v1/chat/completions'), // use the OpenAI-compatible endpoint
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

      // [DeepSeek, 2025-12-01] V3.2-Speciale: Handle @speciale model ID marker
      if (dialect === 'deepseek' && model.id.endsWith(DEEPSEEK_SPECIALE_SUFFIX)) {
        const actualModelId = model.id.slice(0, -DEEPSEEK_SPECIALE_SUFFIX.length);
        const { headers } = openAIAccess(access, actualModelId, '/v1/chat/completions');
        return {
          request: {
            url: DEEPSEEK_SPECIALE_HOST + '/v1/chat/completions',
            headers,
            method: 'POST',
            body: aixToOpenAIChatCompletions('deepseek', { ...model, id: actualModelId }, chatGenerate, streaming),
          },
          demuxerFormat: streaming ? 'fast-sse' : null,
          chatGenerateParse: streaming ? createOpenAIChatCompletionsChunkParser() : createOpenAIChatCompletionsParserNS(),
        };
      }

      // switch to the Responses API if the model supports it
      const isResponsesAPI = !!model.vndOaiResponsesAPI;
      if (isResponsesAPI) {
        return {
          request: {
            ...openAIAccess(access, model.id, '/v1/responses'),
            method: 'POST',
            body: aixToOpenAIResponses(dialect, model, chatGenerate, streaming, enableResumability),
          },
          demuxerFormat: streaming ? 'fast-sse' : null,
          chatGenerateParse: streaming ? createOpenAIResponsesEventParser() : createOpenAIResponseParserNS(),
        };
      }

      return {
        request: {
          ...openAIAccess(access, model.id, '/v1/chat/completions'),
          method: 'POST',
          body: aixToOpenAIChatCompletions(dialect, model, chatGenerate, streaming),
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
export function createChatGenerateResumeDispatch(access: AixAPI_Access, resumeHandle: AixAPI_ResumeHandle, streaming: boolean): ChatGenerateDispatch {

  const { dialect } = access;
  switch (dialect) {
    case 'azure':
    case 'openai':
    case 'openrouter':

      // ASSUME the OpenAI Responses API - https://platform.openai.com/docs/api-reference/responses/get
      const { url, headers } = openAIAccess(access, '', `/v1/responses/${resumeHandle.responseId}`);
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
      // Throw on unsupported protocols (Azure and OpenRouter are speculatively supported)
      throw new Error(`Resume not supported for dialect: ${dialect}`);

  }
}
