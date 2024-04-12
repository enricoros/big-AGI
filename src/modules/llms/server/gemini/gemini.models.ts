import type { GeminiModelSchema } from './gemini.wiretypes';
import type { ModelDescriptionSchema } from '../llm.server.types';
import { LLM_IF_OAI_Chat, LLM_IF_OAI_Vision } from '../../store-llms';


const filterUnallowedNames = ['Legacy'];
const filterUnallowedInterfaces: GeminiModelSchema['supportedGenerationMethods'] = ['generateAnswer', 'embedContent', 'embedText'];

const geminiLinkModels = ['models/gemini-pro', 'models/gemini-pro-vision'];

// interfaces mapping
const geminiChatInterfaces: GeminiModelSchema['supportedGenerationMethods'] = ['generateContent'];
const geminiVisionNames = ['-vision'];


export function geminiFilterModels(geminiModel: GeminiModelSchema): boolean {
  const isAllowed = !filterUnallowedNames.some(name => geminiModel.displayName.includes(name));
  const isSupported = !filterUnallowedInterfaces.some(iface => geminiModel.supportedGenerationMethods.includes(iface));
  return isAllowed && isSupported;
}

export function geminiSortModels(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // hidden to the bottom, then names descending
  if (a.hidden && !b.hidden) return 1;
  if (!a.hidden && b.hidden) return -1;
  return b.label.localeCompare(a.label);
}

export function geminiModelToModelDescription(geminiModel: GeminiModelSchema, allModels: GeminiModelSchema[]): ModelDescriptionSchema {
  const { description, displayName, name: modelId, supportedGenerationMethods } = geminiModel;

  // handle symlinks
  const isSymlink = geminiLinkModels.includes(modelId);
  const symlinked = isSymlink ? allModels.find(m => m.displayName === displayName && m.name !== modelId) : null;
  const label = isSymlink ? `🔗 ${displayName.replace('1.0', '')} → ${symlinked ? symlinked.name : '?'}` : displayName;

  // handle hidden models
  const hasChatInterfaces = supportedGenerationMethods.some(iface => geminiChatInterfaces.includes(iface));
  const hidden = isSymlink || !hasChatInterfaces;

  // context window
  const { inputTokenLimit, outputTokenLimit } = geminiModel;
  const contextWindow = inputTokenLimit + outputTokenLimit;

  // description
  const { version, topK, topP, temperature } = geminiModel;
  const descriptionLong = description + ` (Version: ${version}, Defaults: temperature=${temperature}, topP=${topP}, topK=${topK}, interfaces=[${supportedGenerationMethods.join(',')}])`;

  const interfaces: ModelDescriptionSchema['interfaces'] = [];
  if (hasChatInterfaces) {
    interfaces.push(LLM_IF_OAI_Chat);
    if (geminiVisionNames.some(name => modelId.includes(name)))
      interfaces.push(LLM_IF_OAI_Vision);
  }

  return {
    id: modelId,
    label,
    // created: ...
    // updated: ...
    description: descriptionLong,
    contextWindow: contextWindow,
    maxCompletionTokens: outputTokenLimit,
    // trainingDataCutoff: '...',
    interfaces,
    // rateLimits: isGeminiPro ? { reqPerMinute: 60 } : undefined,
    // benchmarks: ...
    // pricing: isGeminiPro ? { needs per-character and per-image pricing } : undefined,
    hidden,
  };
}
