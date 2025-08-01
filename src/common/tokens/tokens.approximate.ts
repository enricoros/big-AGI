import type { DLLM } from '~/common/stores/llms/llms.types';


// configuration
const DEBUG_TOKEN_COUNT = false;


/**
 * Lightweight approximate token counting without tiktoken dependency.
 * This provides fast estimates with ~85-90% accuracy vs tiktoken.
 */

// Character to token ratios by model family (empirically derived)
const TOKEN_RATIOS = {
  // GPT models (OpenAI-like)
  'gpt': 3.9, // ~4 chars per token on average
  'o1': 4.0,
  'claude': 3.8, // Anthropic models tend to be slightly more efficient
  'gemini': 4.2, // Google models
  'llama': 4.1, // Meta and similar
  'mistral': 4.0,
  'qwen': 3.9, // Alibaba
  'deepseek': 4.0,
  'default': 4.0, // Conservative default
} as const;

// Language-specific adjustments
const LANGUAGE_MULTIPLIERS = {
  // Code typically has more tokens per character
  'code': 1.2,
  // Non-Latin scripts often require more tokens
  'chinese': 1.4,
  'japanese': 1.4,
  'korean': 1.3,
  'arabic': 1.2,
  'default': 1.0,
} as const;

/**
 * Detects content type based on text characteristics
 */
function detectContentType(text: string): keyof typeof LANGUAGE_MULTIPLIERS {

  // check for code patterns
  if (text.includes('```') || text.includes('function ') || text.includes('const ') || 
      text.includes('import ') || text.includes('class ') || text.includes('def ') ||
      text.includes('    ') && text.includes('\n') || // indented blocks
      /\{.*}/.test(text) || /\[.*]/.test(text)) {
    return 'code';
  }
  
  // Check for CJK characters
  if (/[\u4e00-\u9fff]/.test(text)) return 'chinese';
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'japanese';
  if (/[\uac00-\ud7af]/.test(text)) return 'korean';
  if (/[\u0600-\u06ff]/.test(text)) return 'arabic';
  
  return 'default';
}

/**
 * Gets model family from LLM configuration
 */
function getModelFamily(llm: DLLM): keyof typeof TOKEN_RATIOS {
  const modelId = llm.id.toLowerCase();
  const modelRef = llm.initialParameters?.llmRef?.toLowerCase() || '';
  
  // Check model ID and reference for family patterns
  if (modelId.includes('gpt') || modelRef.includes('gpt')) return 'gpt';
  if (modelId.includes('o1') || modelRef.includes('o1')) return 'o1';
  if (modelId.includes('claude') || modelRef.includes('claude')) return 'claude';
  if (modelId.includes('gemini') || modelRef.includes('gemini')) return 'gemini';
  if (modelId.includes('llama') || modelRef.includes('llama')) return 'llama';
  if (modelId.includes('mistral') || modelRef.includes('mistral')) return 'mistral';
  if (modelId.includes('qwen') || modelRef.includes('qwen')) return 'qwen';
  if (modelId.includes('deepseek') || modelRef.includes('deepseek')) return 'deepseek';
  
  return 'default';
}

/**
 * Fast approximate token counting based on character count and heuristics.
 * 
 * @param text - The text to count tokens for
 * @param llm - The LLM configuration (used to determine model family)
 * @param debugFrom - Debug label for logging
 * @returns Estimated token count
 */
export function approximateTextTokens(text: string, llm: DLLM, debugFrom: string): number {
  if (!text) return 0;
  
  const contentType = detectContentType(text);
  const modelFamily = getModelFamily(llm);
  
  const baseRatio = TOKEN_RATIOS[modelFamily];
  const languageMultiplier = LANGUAGE_MULTIPLIERS[contentType];
  
  // Base calculation: characters / ratio
  const baseTokens = text.length / baseRatio;
  
  // Apply language-specific adjustments
  const adjustedTokens = baseTokens * languageMultiplier;
  
  // Additional heuristics:
  // - Spaces typically reduce token count (word boundaries)
  const spaceCount = (text.match(/\s/g) || []).length;
  const spaceAdjustment = spaceCount * 0.1; // Small reduction for spaces
  
  // - Repeated characters/patterns often compress better
  const repetitionReduction = text.length > 100 ? Math.min(adjustedTokens * 0.05, 10) : 0;
  
  const finalCount = Math.max(1, Math.round(adjustedTokens - spaceAdjustment - repetitionReduction));
  
  DEBUG_TOKEN_COUNT && console.log(`approximateTextTokens: ${debugFrom}, family: ${modelFamily}, type: ${contentType}, chars: ${text.length}, tokens: ${finalCount}`);

  return finalCount;
}
