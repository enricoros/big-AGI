import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { llmtrHeuristic, llmtrModelsToModelDescriptions } from './llmtr.models';


// rows from LLMTR's /v1/models (2026-11-16), descriptions emptied: tokenizer is null on every row
const _wireRows = [
  {"id": "llmtr/qwen3-8-27b", "object": "model", "created": 1791267994, "owned_by": "llmtr", "supported_operations": ["CHAT_COMPLETIONS"], "name": "Qwen 3.8 27B", "description": "", "context_length": 262144, "architecture": {"modality": "text->text", "input_modalities": ["text"], "output_modalities": ["text"], "tokenizer": null, "instruct_type": null}, "pricing": {"prompt": "0.000005", "completion": "0.000007", "input_cache_read": "0.00000125"}, "top_provider": {"context_length": 262144, "max_completion_tokens": 262144, "is_moderated": false}, "supported_parameters": ["include_reasoning", "max_completion_tokens", "max_tokens", "parallel_tool_calls", "reasoning", "response_format", "structured_outputs", "temperature", "tool_choice", "tools", "top_p"], "per_request_limits": null, "reasoning": {"mandatory": false, "default_enabled": false, "supported_efforts": []}},
  {"id": "anthropic/claude-sonnet-5", "object": "model", "created": 1782880538, "owned_by": "anthropic", "supported_operations": ["CHAT_COMPLETIONS"], "name": "Claude Sonnet 5", "description": "", "context_length": 1000000, "architecture": {"modality": "text+image+file->text", "input_modalities": ["text", "image", "file"], "output_modalities": ["text"], "tokenizer": null, "instruct_type": null}, "pricing": {"prompt": "0.000002", "completion": "0.00001", "input_cache_read": "0.0000002", "input_cache_write": "0.0000025", "input_cache_write_1h": "0.000004"}, "top_provider": {"context_length": 1000000, "max_completion_tokens": 128000, "is_moderated": false}, "supported_parameters": ["max_completion_tokens", "max_tokens", "parallel_tool_calls", "reasoning_effort", "tool_choice", "tools"], "per_request_limits": null, "reasoning": {"mandatory": false, "default_enabled": true, "supported_efforts": ["low", "medium", "high", "xhigh"]}},
  {"id": "openai/gpt-6-sol", "object": "model", "created": 1790159267, "owned_by": "openai", "supported_operations": ["RESPONSES"], "name": "GPT-6 Sol", "description": "", "context_length": 1050000, "architecture": {"modality": "text+image+file->text", "input_modalities": ["text", "image", "file"], "output_modalities": ["text"], "tokenizer": null, "instruct_type": null}, "pricing": {"prompt": "0.000002", "completion": "0.00001", "input_cache_read": "0.0000002", "input_cache_write": "0.0000025"}, "top_provider": {"context_length": 1050000, "max_completion_tokens": 1050000, "is_moderated": false}, "supported_parameters": ["include_reasoning", "max_completion_tokens", "max_tokens", "parallel_tool_calls", "reasoning", "reasoning_effort", "response_format", "structured_outputs", "tool_choice", "tools"], "per_request_limits": null, "reasoning": {"mandatory": false, "default_enabled": false, "supported_efforts": ["none", "low", "medium", "high", "xhigh", "max"]}},
  {"id": "llmtr/embeddingmagibu-200m", "object": "model", "created": 1792040573, "owned_by": "llmtr", "supported_operations": ["EMBEDDINGS"], "name": "EmbeddingMagibu 200M", "description": "", "context_length": 8192, "architecture": {"modality": "text->embedding", "input_modalities": ["text"], "output_modalities": ["embedding"], "tokenizer": null, "instruct_type": null}, "pricing": {"prompt": "0.00000001"}, "top_provider": {"context_length": 8192, "max_completion_tokens": 8192, "is_moderated": false}, "supported_parameters": [], "per_request_limits": null},
];


describe('llmtr.models', () => {

  test('matches the LLMTR host only', () => {
    assert.equal(llmtrHeuristic('https://llmtr.com/v1/models'), true);
    assert.equal(llmtrHeuristic('https://api.openai.com/v1/models'), false);
  });

  test('keeps chat completion rows despite the null tokenizer', () => {
    const models = llmtrModelsToModelDescriptions({ object: 'list', data: _wireRows });
    assert.deepEqual(models.map(m => m.id).sort(), ['anthropic/claude-sonnet-5', 'llmtr/qwen3-8-27b']);

    const qwen = models.find(m => m.id === 'llmtr/qwen3-8-27b')!;
    assert.equal(qwen.contextWindow, 262144);
    assert.deepEqual({ input: qwen.chatPrice?.input, output: qwen.chatPrice?.output }, { input: 5, output: 7 });
  });

  test('strips OpenRouter-only parameters', () => {
    for (const model of llmtrModelsToModelDescriptions({ data: _wireRows }))
      assert.equal(model.parameterSpecs?.some(p => p.paramId.startsWith('llmVndOrt')) ?? false, false, model.id);
  });

});
