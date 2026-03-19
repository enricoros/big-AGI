import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';


test('participant model selectors use getLLMLabel so custom model names appear in agent settings', () => {
  const source = readFileSync(new URL('./ChatBarChat.tsx', import.meta.url), 'utf8');

  assert.match(source, /import\s*\{\s*getLLMLabel,\s*type DLLM\s*\}\s*from '~\/common\/stores\/llms\/llms\.types'/);
  assert.equal((source.match(/\{getLLMLabel\(llm\)\}/g) ?? []).length >= 2, true);
  assert.match(source, /New agent uses \$\{getLLMLabel\(selectedParticipantLlm\)\}\./);
  assert.match(source, /const llmLabel = participantLlm \? getLLMLabel\(participantLlm\) : participant\.llmId \?\? 'Chat model';/);
  assert.doesNotMatch(source, /<Option key=\{llm\.id\} value=\{llm\.id\}>\{llm\.label\}<\/Option>/);
});
