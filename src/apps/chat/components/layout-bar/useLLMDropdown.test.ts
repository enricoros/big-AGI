import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('useLLMDropdown shows model reasoning inline in the dropdown and keeps per-model settings actions', () => {
  const source = readFileSync(new URL('./useLLMDropdown.tsx', import.meta.url), 'utf8');

  assert.match(source, /import\s*\{\s*getReasoningEffortOptions,\s*getParticipantReasoningEffortSelectState\s*\}\s*from '\.\/ChatBarChat\.reasoning';/);
  assert.match(source, /import \{ useModelsStore \} from '~\/common\/stores\/llms\/store-llms';/);
  assert.doesNotMatch(source, /function ModelReasoningControl\(props:/);
  assert.match(source, /const renderModelReasoningControl = React\.useCallback\(\s*\(itemKey: string\) => \{/);
  assert.match(source, /title=["']Cycle reasoning effort["']/);
  assert.match(source, /updateLLMUserParameters\(itemKey, \{\s*\[llmReasoningConfig\.parameterId\]: nextOption\.value,\s*\}\)/);
  assert.match(source, /renderItemInlineControl=\{renderModelReasoningControl\}/);
  assert.match(source, /inlineLabel:\s*llmReasoningConfig\.parameterId/);
  assert.match(source, /const renderModelOptionsButton = React\.useCallback\(\s*\(itemKey: string, isActive: boolean\) => \{/);
  assert.match(source, /optimaActions\(\)\.openModelOptions\(itemKey\)/);
  assert.match(source, /renderItemEndDecorator=\{renderModelOptionsButton\}/);
  assert.match(source, /const llmReasoningState = getParticipantReasoningEffortSelectState\(\{/);
  assert.doesNotMatch(source, /placeholder=\{reasoningState\.modelSettingLabel\}/);
});
