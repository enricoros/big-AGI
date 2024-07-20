import { anthropicAccess } from '~/modules/llms/server/anthropic/anthropic.router';
import { geminiAccess } from '~/modules/llms/server/gemini/gemini.router';
import { openAIAccess } from '~/modules/llms/server/openai/openai.router';

import type { AixAPI_Access, AixAPI_Model, AixAPIChatGenerate_Request } from '../../api/aix.wiretypes';

import { GeminiWire_API_Generate_Content } from '../wiretypes/gemini.wiretypes';

import { aixToAnthropicMessageCreate } from './adapters/anthropic.messageCreate';
import { aixToGeminiGenerateContent } from './adapters/gemini.generateContent';
import { aixToOpenAIChatCompletions } from './adapters/openai.chatCompletions';

import { createAnthropicMessageParser, createAnthropicMessageParserNS } from './parsers/anthropic.parser';
import { createGeminiGenerateContentResponseParser } from './parsers/gemini.parser';
import { createOpenAIChatCompletionsChunkParser, createOpenAIChatCompletionsParserNS } from './parsers/openai.parser';

import type { PartTransmitter } from '../../api/PartTransmitter';
import type { StreamDemuxerFormat } from '../stream.demuxers';


export type ChatGenerateParseFunction = (partTransmitter: PartTransmitter, eventData: string, eventName?: string) => void;


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
        chatGenerateParse: createGeminiGenerateContentResponseParser(model.id),
      };

    case 'ollama':
      throw new Error('Ollama is not supported in this context');
    // return {
    //   request: {
    //     ...ollamaAccess(access, OLLAMA_PATH_CHAT),
    //     body: ollamaChatCompletionPayload(model, _hist, access.ollamaJson, streaming),
    //   },
    //   demuxerFormat: streaming ? 'json-nl' : null,
    //   chatGenerateParse: createDispatchParserOllama(),
    // };

    case 'azure':
    case 'deepseek':
    case 'groq':
    case 'lmstudio':
    case 'localai':
    case 'mistral':
    case 'oobabooga':
    case 'openai':
    case 'openrouter':
    case 'perplexity':
    case 'togetherai':
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
