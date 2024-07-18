function getModelFromFile(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.split('/').pop() || '';
}


export function prettyBaseModel(model: string | undefined): string {
  if (!model) return '';
  // [OpenAI]
  if (model.includes('gpt-4-vision-preview')) return 'GPT-4 Vision';
  if (model.includes('gpt-4-1106-preview')) return 'GPT-4 Turbo';
  if (model.includes('gpt-4-32k')) return 'GPT-4-32k';
  if (model.includes('gpt-4o-mini')) return 'GPT-4o Mini';
  if (model.includes('gpt-4o')) return 'GPT-4o';
  if (model.includes('gpt-4-turbo')) return 'GPT-4 Turbo';
  if (model.includes('gpt-4')) return 'GPT-4';
  if (model.includes('gpt-3.5-turbo-instruct')) return '3.5 Turbo Instruct';
  if (model.includes('gpt-3.5-turbo-1106')) return '3.5 Turbo 16k';
  if (model.includes('gpt-3.5-turbo-16k')) return '3.5 Turbo 16k';
  if (model.includes('gpt-3.5-turbo')) return '3.5 Turbo';
  // [LocalAI?]
  if (model.endsWith('.bin')) return model.slice(0, -4);
  // [Anthropic]
  const prettyAnthropic = prettyAnthropicModelName(model);
  if (prettyAnthropic) return prettyAnthropic;
  // [LM Studio]
  if (model.startsWith('C:\\') || model.startsWith('D:\\'))
    return getModelFromFile(model).replace('.gguf', '');
  // [Ollama]
  if (model.includes(':'))
    return model.replace(':latest', '').replaceAll(':', ' ');
  return model;
}

function prettyAnthropicModelName(modelId: string): string | null {
  const claudeIndex = modelId.indexOf('claude-3');
  if (claudeIndex === -1) return null;

  const subStr = modelId.slice(claudeIndex);
  const is35 = subStr.includes('-3-5-');
  const version = is35 ? '3.5' : '3';

  if (subStr.includes(`-opus`)) return `Claude ${version} Opus`;
  if (subStr.includes(`-sonnet`)) return `Claude ${version} Sonnet`;
  if (subStr.includes(`-haiku`)) return `Claude ${version} Haiku`;

  return `Claude ${version}`;
}