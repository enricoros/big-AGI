import { anthropicAccess } from '~/modules/llms/server/anthropic/anthropic.router';
import { geminiAccess } from '~/modules/llms/server/gemini/gemini.router';
import { openAIAccess } from '~/modules/llms/server/openai/openai.router';

import type { Intake_Access, Intake_ChatGenerateRequest, Intake_Model } from '../../intake/schemas.intake.api';

import { GeminiWire_API_Generate_Content } from '../wiretypes/gemini.wiretypes';
import { intakeToAnthropicMessageCreate } from './anthropic/anthropic.adapters';
import { intakeToOpenAIMessageCreate } from './openai/oai.adapters';

import type { ChatGenerateParseFunction } from './chatGenerate.types';
import type { StreamDemuxerFormat } from '../stream.demuxers';
import { createAnthropicMessageParser, createAnthropicMessageParserNS, createGeminiGenerateContentParser, createOpenAIMessageCreateParser } from './chatGenerate.parsers';


export function createChatGenerateDispatch(access: Intake_Access, model: Intake_Model, chatGenerate: Intake_ChatGenerateRequest, streaming: boolean): {
  request: { url: string, headers: HeadersInit, body: object },
  demuxerFormat: StreamDemuxerFormat;
  chatGenerateParse: ChatGenerateParseFunction;
} {

  switch (access.dialect) {
    case 'anthropic':
      return {
        request: {
          ...anthropicAccess(access, '/v1/messages'),
          body: intakeToAnthropicMessageCreate(model, chatGenerate, streaming),
        },
        demuxerFormat: streaming ? 'sse' : null,
        chatGenerateParse: streaming ? createAnthropicMessageParser() : createAnthropicMessageParserNS(),
      };

    case 'gemini':
      return {
        request: {
          ...geminiAccess(access, model.id, streaming ? GeminiWire_API_Generate_Content.streamingPostPath : GeminiWire_API_Generate_Content.postPath),
          body: {}, //intakeToGeminiGenerateContent(model, chatGenerate, access.minSafetyLevel, false, streaming),
        },
        demuxerFormat: streaming ? 'sse' : null,
        chatGenerateParse: createGeminiGenerateContentParser(model.id),
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
          body: intakeToOpenAIMessageCreate(access.dialect, model, chatGenerate, false, streaming),
        },
        demuxerFormat: streaming ? 'sse' : null,
        chatGenerateParse: createOpenAIMessageCreateParser(),
      };
  }
}
