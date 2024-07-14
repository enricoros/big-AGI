import { anthropicAccess } from '~/modules/llms/server/anthropic/anthropic.router';
import { openAIAccess } from '~/modules/llms/server/openai/openai.router';

import type { Intake_Access, Intake_ChatGenerateRequest, Intake_Model } from '../../intake/schemas.intake.api';

import { intakeToAnthropicMessageCreate } from './anthropic/anthropic.adapters';
import { intakeToOpenAIMessageCreate } from './openai/oai.adapters';

import type { ChatGenerateParseFunction } from './chatGenerate.types';
import type { StreamDemuxerFormat } from '../stream.demuxers';
import { createAnthropicMessageParser, createAnthropicMessageParserNS, createOpenAIMessageCreateParser } from './chatGenerate.parsers';


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
      throw new Error('Gemini is not supported in this context');
    // return {
    //   request: {
    //     ...geminiAccess(access, model.id, streaming ? geminiModelsStreamGenerateContentPath : geminiModelsGenerateContentPath),
    //     // body: geminiGenerateContentTextPayload(model, _hist, access.minSafetyLevel, 1),
    //   },
    //   demuxerFormat: streaming ? 'sse' : null,
    //   chatGenerateParse: createDispatchParserGemini(model.id.replace('models/', '')),
    // };

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
