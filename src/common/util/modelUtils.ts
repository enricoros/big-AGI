function getModelFromFile(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.split('/').pop() || '';
}


export function prettyBaseModel(model: string | undefined): string {
  if (!model) return '';
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
  if (model.endsWith('.bin')) return model.slice(0, -4);
  // [Anthropic]
  if (model.includes('claude-3-opus')) return 'Claude 3 Opus';
  if (model.includes('claude-3-sonnet')) return 'Claude 3 Sonnet';
  // [LM Studio]
  if (model.startsWith('C:\\') || model.startsWith('D:\\'))
    return getModelFromFile(model).replace('.gguf', '');
  // [Ollama]
  if (model.includes(':'))
    return model.replace(':latest', '').replaceAll(':', ' ');
  return model;
}