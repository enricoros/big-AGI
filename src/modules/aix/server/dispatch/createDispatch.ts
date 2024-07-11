import { OLLAMA_PATH_CHAT, ollamaAccess, ollamaChatCompletionPayload } from '~/modules/llms/server/ollama/ollama.router';
import { anthropicAccess } from '~/modules/llms/server/anthropic/anthropic.router';
import { geminiAccess, geminiGenerateContentTextPayload } from '~/modules/llms/server/gemini/gemini.router';
import { openAIAccess, openAIChatCompletionPayload, OpenAIHistorySchema } from '~/modules/llms/server/openai/openai.router';

import type { IntakeAccess, IntakeChatGenerateRequest, IntakeModel } from '../intake/schemas.intake.api';

import { intakeToAnthropicMessageCreate } from './anthropic/anthropic.adapter';

import { createDispatchDemuxer } from './dispatch.demuxers';
import { createDispatchParserAnthropicMessages, createDispatchParserGemini, createDispatchParserOllama, createDispatchParserOpenAI, DispatchParser } from './dispatch.parsers';
import { geminiModelsStreamGenerateContentPath } from './gemini/gemini.wiretypes';


export function createDispatch(access: IntakeAccess, model: IntakeModel, chatGenerate: IntakeChatGenerateRequest): {
  request: { url: string, headers: HeadersInit, body: object },
  demuxer: ReturnType<typeof createDispatchDemuxer>;
  parser: DispatchParser;
} {

  // temporarily re-cast back to history

  const _hist: OpenAIHistorySchema = [];
  if (access.dialect !== 'anthropic') {
    chatGenerate.systemMessage?.parts.forEach(systemPart => {
      _hist.push({ role: 'system', content: systemPart.text });
    });
    chatGenerate.chat.forEach(({ role, parts }) => {
      switch (role) {

        case 'user':
          parts.forEach(userPart => {
            switch (userPart.pt) {
              case 'text':
                _hist.push({ role: 'user', content: userPart.text });
                break;
              case 'inline_image':
                throw new Error('Inline images are not supported');
              case 'doc':
                _hist.push({ role: 'user', content: userPart.data.text });
                break;
              case 'meta_reply_to':
                throw new Error('Meta reply to is not supported');
            }
          });
          break;

        case 'model':
          parts.forEach(modelPart => {
            switch (modelPart.pt) {
              case 'text':
                _hist.push({ role: 'assistant', content: modelPart.text });
                break;
              case 'tool_call':
                throw new Error('Tool calls are not supported');
            }
          });
          break;

        case 'tool':
          parts.forEach(toolPart => {
            switch (toolPart.pt) {
              case 'tool_response':
                throw new Error('Tool responses are not supported');
            }
          });
          break;
      }
    });
    console.log('converted chatGenerate to history', _hist.length, '<- items');
  }


  const conversionWarnings: string[] = [];
  switch (access.dialect) {
    case 'anthropic':
      return {
        request: {
          ...anthropicAccess(access, '/v1/messages'),
          body: intakeToAnthropicMessageCreate(model, chatGenerate, true, conversionWarnings),
        },
        demuxer: createDispatchDemuxer('sse'),
        parser: createDispatchParserAnthropicMessages(),
      };

    case 'gemini':
      return {
        request: {
          ...geminiAccess(access, model.id, geminiModelsStreamGenerateContentPath),
          body: geminiGenerateContentTextPayload(model, _hist, access.minSafetyLevel, 1),
        },
        demuxer: createDispatchDemuxer('sse'),
        parser: createDispatchParserGemini(model.id.replace('models/', '')),
      };

    case 'ollama':
      return {
        request: {
          ...ollamaAccess(access, OLLAMA_PATH_CHAT),
          body: ollamaChatCompletionPayload(model, _hist, access.ollamaJson, true),
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
          body: openAIChatCompletionPayload(access.dialect, model, _hist, null, null, 1, true),
        },
        demuxer: createDispatchDemuxer('sse'),
        parser: createDispatchParserOpenAI(),
      };
  }
}
