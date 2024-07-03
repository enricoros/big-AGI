import type { AixAccess, AixHistory, AixModel } from '../shared/aix.shared.types';

import { OLLAMA_PATH_CHAT, ollamaAccess, ollamaChatCompletionPayload } from '~/modules/llms/server/ollama/ollama.router';
import { anthropicAccess, anthropicMessagesPayloadOrThrow } from '~/modules/llms/server/anthropic/anthropic.router';
import { geminiAccess, geminiGenerateContentTextPayload } from '~/modules/llms/server/gemini/gemini.router';
import { geminiModelsStreamGenerateContentPath } from '~/modules/llms/server/gemini/gemini.wiretypes';
import { openAIAccess, openAIChatCompletionPayload } from '~/modules/llms/server/openai/openai.router';

import { createStreamParserAnthropicMessages, createStreamParserGemini, createStreamParserOllama, createStreamParserOpenAI, UpstreamEventParseFunction } from './upstream.parsers';
import { createUpstreamDemuxer } from './upstream.demuxers';


export function prepareUpstream(access: AixAccess, model: AixModel, history: AixHistory): {
  request: { url: string, headers: HeadersInit, body: object },
  demuxer: ReturnType<typeof createUpstreamDemuxer>;
  parser: UpstreamEventParseFunction;
} {
  switch (access.dialect) {
    case 'anthropic':
      return {
        request: {
          ...anthropicAccess(access, '/v1/messages'),
          body: anthropicMessagesPayloadOrThrow(model, history, true),
        },
        demuxer: createUpstreamDemuxer('sse'),
        parser: createStreamParserAnthropicMessages(),
      };

    case 'gemini':
      return {
        request: {
          ...geminiAccess(access, model.id, geminiModelsStreamGenerateContentPath),
          body: geminiGenerateContentTextPayload(model, history, access.minSafetyLevel, 1),
        },
        demuxer: createUpstreamDemuxer('sse'),
        parser: createStreamParserGemini(model.id.replace('models/', '')),
      };

    case 'ollama':
      return {
        request: {
          ...ollamaAccess(access, OLLAMA_PATH_CHAT),
          body: ollamaChatCompletionPayload(model, history, access.ollamaJson, true),
        },
        demuxer: createUpstreamDemuxer('json-nl'),
        parser: createStreamParserOllama(),
      };

    case 'azure':
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
        demuxer: createUpstreamDemuxer('sse'),
        parser: createStreamParserOpenAI(),
      };
  }
}
