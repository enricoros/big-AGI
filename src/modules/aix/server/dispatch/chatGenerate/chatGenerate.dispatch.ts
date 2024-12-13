import { anthropicAccess } from '~/modules/llms/server/anthropic/anthropic.router';
import { geminiAccess } from '~/modules/llms/server/gemini/gemini.router';
import { ollamaAccess } from '~/modules/llms/server/ollama/ollama.router';
import { openAIAccess } from '~/modules/llms/server/openai/openai.router';

import type { AixAPI_Access, AixAPI_Model, AixAPIChatGenerate_Request } from '../../api/aix.wiretypes';
import type { StreamDemuxerFormat } from '../stream.demuxers';

import { GeminiWire_API_Generate_Content } from '../wiretypes/gemini.wiretypes';

import { aixToAnthropicMessageCreate } from './adapters/anthropic.messageCreate';
import { aixToGeminiGenerateContent } from './adapters/gemini.generateContent';
import { aixToOpenAIChatCompletions } from './adapters/openai.chatCompletions';

import type { IParticleTransmitter } from './IParticleTransmitter';
import { createAnthropicMessageParser, createAnthropicMessageParserNS } from './parsers/anthropic.parser';
import { createGeminiGenerateContentResponseParser } from './parsers/gemini.parser';
import { createOpenAIChatCompletionsChunkParser, createOpenAIChatCompletionsParserNS } from './parsers/openai.parser';


/**
 * Interface for the vendor parsers to implement
 */
export type ChatGenerateParseFunction = (partTransmitter: IParticleTransmitter, eventData: string, eventName?: string) => void;


/**
 * Specializes to the correct vendor a request for chat generation
 */
export function createChatGenerateDispatch(access: AixAPI_Access, model: AixAPI_Model, chatGenerate: AixAPIChatGenerate_Request, streaming: boolean): {
  request: { url: string, headers: HeadersInit, body: object },
  demuxerFormat: StreamDemuxerFormat;
  chatGenerateParse: ChatGenerateParseFunction;
} {

  switch (access.dialect) {
    case 'anthropic':
      return {
        request: {
          ...anthropicAccess(access, '/v1/messages'),
          body: aixToAnthropicMessageCreate(model, chatGenerate, streaming),
        },
        demuxerFormat: streaming ? 'sse' : null,
        chatGenerateParse: streaming ? createAnthropicMessageParser() : createAnthropicMessageParserNS(),
      };

    case 'gemini':
      return {
        request: {
          ...geminiAccess(access, model.id, streaming ? GeminiWire_API_Generate_Content.streamingPostPath : GeminiWire_API_Generate_Content.postPath),
          body: aixToGeminiGenerateContent(model, chatGenerate, access.minSafetyLevel, false, streaming),
        },
        demuxerFormat: streaming ? 'sse' : null,
        chatGenerateParse: createGeminiGenerateContentResponseParser(model.id, streaming),
      };

    /**
     * Ollama has now an OpenAI compability layer for `chatGenerate` API, but still its own protocol for models listing.
     * - as such, we 'cast' here to the dispatch to an OpenAI dispatch, while using Ollama access
     * - we still use the ollama.router for the models listing and aministration APIs
     *
     * For reference we show the old code for body/demuxerFormat/chatGenerateParse also below
     */
    case 'ollama':
      return {
        request: {
          ...ollamaAccess(access, '/v1/chat/completions'), // use the OpenAI-compatible endpoint
          // body: ollamaChatCompletionPayload(model, _hist, access.ollamaJson, streaming),
          body: aixToOpenAIChatCompletions('openai', model, chatGenerate, access.ollamaJson, streaming),
        },
        // demuxerFormat: streaming ? 'json-nl' : null,
        demuxerFormat: streaming ? 'sse' : null,
        // chatGenerateParse: createDispatchParserOllama(),
        chatGenerateParse: streaming ? createOpenAIChatCompletionsChunkParser() : createOpenAIChatCompletionsParserNS(),
      };

    case 'azure':
    case 'deepseek':
    case 'groq':
    case 'lmstudio':
    case 'localai':
    case 'mistral':
    case 'openai':
    case 'openpipe':
    case 'openrouter':
    case 'perplexity':
    case 'togetherai':
    case 'xai':
      return {
        request: {
          ...openAIAccess(access, model.id, '/v1/chat/completions'),
          body: aixToOpenAIChatCompletions(access.dialect, model, chatGenerate, false, streaming),
        },
        demuxerFormat: streaming ? 'sse' : null,
        chatGenerateParse: streaming ? createOpenAIChatCompletionsChunkParser() : createOpenAIChatCompletionsParserNS(),
      };
  }
}
