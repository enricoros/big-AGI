---
description: Verify model parameterSpecs match API-validated sweep data
argument-hint: openai | anthropic | gemini | xai (or empty for all)
---

# Verify LLM Parameters

Compare model `parameterSpecs` in definition files against API-validated sweep data.

If `$ARGUMENTS` provided, verify only that dialect, which includes reading the pair of sweep results and model defintions. Otherwise verify all four, and read the pairs in sequence.

## Files

**Sweep results** (source of truth for select parameters):
- `tools/develop/llm-parameter-sweep/llm-{dialect}-parameters-sweep.json`
  By the time you see these files, the repo owner has already updated them via `tools/develop/llm-parameter-sweep/sweep.sh` (very long running, 15 min per vendor).

**Model definitions (source of truth for model defintions for the user and application, including constants, interfaces, supported parameters and sometimes allowed parameter values)**:
- OpenAI: `src/modules/llms/server/openai/models/openai.models.ts`
- Anthropic: `src/modules/llms/server/anthropic/anthropic.models.ts`
- Gemini: `src/modules/llms/server/gemini/gemini.models.ts`
- xAI: `src/modules/llms/server/openai/models/xai.models.ts`

## Task

The sweep data is the source of truth for allowed model parameter values or value ranges.

For each model in the sweep, verify the model definition exposes exactly those capabilities - no more, no less. This includes:
- The parameter is present in parameterSpecs
- The paramId variant covers exactly the values from the sweep, if applicable
- etc.

Report models where the definition doesn't match the sweep.

## Parameter Mapping

Example parameter mapping. Note that new parameters may have been added to both the definition, and the sweep.
The objective of the sweep is to hint at model definition values, but the model definitions are what matters for Big-AGI,
and need to be carefully updated, otherwise thousands of clients may break.

| Dialect | Sweep Key | Model paramId |
|---------|-----------|---------------|
| OpenAI | `oai-reasoning-effort` | `llmVndOaiReasoningEffort*` (multiple variants) |
| OpenAI | `oai-verbosity` | `llmVndOaiVerbosity` |
| OpenAI | `oai-image-generation` | `llmVndOaiImageGeneration` |
| OpenAI | `oai-web-search` | `llmVndOaiWebSearchContext` |
| Anthropic | `ant-effort` | `llmVndAntEffort` |
| Anthropic | `ant-thinking-budget` | `llmVndAntThinkingBudget` |
| Gemini | `gemini-thinking-level` | `llmVndGeminiThinkingLevel*` |
| Gemini | `gemini-thinking-budget` | `llmVndGeminiThinkingBudget` |
| xAI | `xai-web-search` | `llmVndXaiWebSearch` |

## Output

Report first for every model the expected values from the sweep, then the actual values from the definition, then the mismatches.

Finally make one table for each dialect listing all models with mismatches and the specific issues.
