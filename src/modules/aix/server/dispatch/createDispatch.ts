import { OLLAMA_PATH_CHAT, ollamaAccess, ollamaChatCompletionPayload } from '~/modules/llms/server/ollama/ollama.router';
import { anthropicAccess, anthropicMessagesPayloadOrThrow } from '~/modules/llms/server/anthropic/anthropic.router';
import { geminiAccess, geminiGenerateContentTextPayload } from '~/modules/llms/server/gemini/gemini.router';
import { openAIAccess, openAIChatCompletionPayload } from '~/modules/llms/server/openai/openai.router';

import type { AixAccess, AixHistory, AixModel } from '../intake/aix.intake.types';

import { createDispatchDemuxer } from './dispatch.demuxers';
import { createDispatchParserAnthropicMessages, createDispatchParserGemini, createDispatchParserOllama, createDispatchParserOpenAI, DispatchParser } from './dispatch.parsers';
import { geminiModelsStreamGenerateContentPath } from './gemini/gemini.wiretypes';


export function createDispatch(access: AixAccess, model: AixModel, history: AixHistory): {
  request: { url: string, headers: HeadersInit, body: object },
  demuxer: ReturnType<typeof createDispatchDemuxer>;
  parser: DispatchParser;
} {
  switch (access.dialect) {
    case 'anthropic':
      return {
        request: {
          ...anthropicAccess(access, '/v1/messages'),
          body: anthropicMessagesPayloadOrThrow(model, history, true),
        },
        demuxer: createDispatchDemuxer('sse'),
        parser: createDispatchParserAnthropicMessages(),
      };

    case 'gemini':
      return {
        request: {
          ...geminiAccess(access, model.id, geminiModelsStreamGenerateContentPath),
          body: geminiGenerateContentTextPayload(model, history, access.minSafetyLevel, 1),
        },
        demuxer: createDispatchDemuxer('sse'),
        parser: createDispatchParserGemini(model.id.replace('models/', '')),
      };

    case 'ollama':
      return {
        request: {
          ...ollamaAccess(access, OLLAMA_PATH_CHAT),
          body: ollamaChatCompletionPayload(model, history, access.ollamaJson, true),
        },
        demuxer: createDispatchDemuxer('json-nl'),
        parser: createDispatchParserOllama(),
      };

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
          body: openAIChatCompletionPayload(access.dialect, model, history, null, null, 1, true),
        },
        demuxer: createDispatchDemuxer('sse'),
        parser: createDispatchParserOpenAI(),
      };
  }
}
