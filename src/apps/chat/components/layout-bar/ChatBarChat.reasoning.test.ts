import assert from 'node:assert/strict';
import test from 'node:test';

import type { DLLM } from '~/common/stores/llms/llms.types';

import {
  getParticipantReasoningEffortCompactLabel,
  getParticipantReasoningEffortDraftValue,
  getParticipantReasoningEffortSelectState,
  PARTICIPANT_REASONING_EFFORT_META,
  PARTICIPANT_REASONING_EFFORT_ORDER,
  PARTICIPANT_REASONING_MODEL_SETTING_VALUE,
} from './ChatBarChat.reasoning';

const options = PARTICIPANT_REASONING_EFFORT_ORDER.map(value => ({
  value,
  label: PARTICIPANT_REASONING_EFFORT_META[value].label,
  description: PARTICIPANT_REASONING_EFFORT_META[value].description,
}));

test('uses the model-setting sentinel and shows the resolved configured effort', () => {
  const llm = {
    initialParameters: { llmVndOaiEffort: 'medium' },
    userParameters: { llmVndOaiEffort: 'xhigh' },
  } as DLLM;

  const result = getParticipantReasoningEffortSelectState({
    llm,
    parameterId: 'llmVndOaiEffort',
    options,
    selectedReasoningEffort: undefined,
  });

  assert.deepStrictEqual(result, {
    selectValue: PARTICIPANT_REASONING_MODEL_SETTING_VALUE,
    helperText: 'Using model setting: X-High. Hardest thinking, best quality',
    modelSettingLabel: 'X-High',
  });
});

test('falls back to provider/model default when the model has no explicit setting', () => {
  const llm = {
    initialParameters: {},
    userParameters: {},
  } as DLLM;

  const result = getParticipantReasoningEffortSelectState({
    llm,
    parameterId: 'llmVndOaiEffort',
    options,
    selectedReasoningEffort: null,
  });

  assert.deepStrictEqual(result, {
    selectValue: PARTICIPANT_REASONING_MODEL_SETTING_VALUE,
    helperText: 'Using model setting: Model default. Provider/model default',
    modelSettingLabel: 'Model default',
  });
});

test('shows the explicit participant override when one is selected', () => {
  const llm = {
    initialParameters: { llmVndOaiEffort: 'low' },
    userParameters: {},
  } as DLLM;

  const result = getParticipantReasoningEffortSelectState({
    llm,
    parameterId: 'llmVndOaiEffort',
    options,
    selectedReasoningEffort: 'high',
  });

  assert.deepStrictEqual(result, {
    selectValue: 'high',
    helperText: 'Deep, thorough analysis',
    modelSettingLabel: 'Low',
  });
});

test('keeps an explicit draft reset to model setting instead of falling back to the persisted override', () => {
  assert.equal(getParticipantReasoningEffortDraftValue({
    draft: { reasoningEffort: null },
    persistedReasoningEffort: 'medium',
  }), null);
});

test('compact reasoning label uses the model setting summary when no override is selected', () => {
  const llm = {
    initialParameters: {},
    userParameters: { llmVndOaiEffort: 'high' },
  } as DLLM;

  assert.equal(getParticipantReasoningEffortCompactLabel({
    llm,
    parameterId: 'llmVndOaiEffort',
    options,
    selectedReasoningEffort: null,
  }), 'Use model setting (High)');
});

test('compact reasoning label uses the explicit override label when one is selected', () => {
  const llm = {
    initialParameters: {},
    userParameters: { llmVndOaiEffort: 'high' },
  } as DLLM;

  assert.equal(getParticipantReasoningEffortCompactLabel({
    llm,
    parameterId: 'llmVndOaiEffort',
    options,
    selectedReasoningEffort: 'medium',
  }), 'Medium');
});
