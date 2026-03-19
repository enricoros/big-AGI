import type { DLLM } from '~/common/stores/llms/llms.types';
import {
  DModelReasoningEffort,
  getAllModelParameterValues,
  sanitizeModelReasoningEffort,
  type DModelReasoningEffortParamId,
} from '~/common/stores/llms/llms.parameters';


export const PARTICIPANT_REASONING_MODEL_SETTING_VALUE = '__model-setting__';

export const PARTICIPANT_REASONING_EFFORT_ORDER = ['max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none'] as const satisfies readonly DModelReasoningEffort[];

export const PARTICIPANT_REASONING_EFFORT_META: Record<DModelReasoningEffort, { label: string; description: string }> = {
  max: { label: 'Max', description: 'Deepest reasoning' },
  xhigh: { label: 'X-High', description: 'Hardest thinking, best quality' },
  high: { label: 'High', description: 'Deep, thorough analysis' },
  medium: { label: 'Medium', description: 'Balanced reasoning depth' },
  low: { label: 'Low', description: 'Quick, concise responses' },
  minimal: { label: 'Minimal', description: 'Fastest, least reasoning' },
  none: { label: 'None', description: 'No reasoning' },
};

type ParticipantReasoningOption = {
  value: DModelReasoningEffort;
  label: string;
  description: string;
};

export function getParticipantReasoningEffortSelectState(args: {
  llm: DLLM | null;
  parameterId: DModelReasoningEffortParamId | null;
  options: readonly ParticipantReasoningOption[];
  selectedReasoningEffort: DModelReasoningEffort | null | undefined;
}): {
  selectValue: DModelReasoningEffort | typeof PARTICIPANT_REASONING_MODEL_SETTING_VALUE;
  helperText: string;
  modelSettingLabel: string;
} {
  if (!args.parameterId) {
    return {
      selectValue: args.selectedReasoningEffort ?? PARTICIPANT_REASONING_MODEL_SETTING_VALUE,
      helperText: 'Not supported by the current model',
      modelSettingLabel: 'Unavailable',
    };
  }

  const selectedOption = args.selectedReasoningEffort
    ? args.options.find(option => option.value === args.selectedReasoningEffort) ?? null
    : null;

  const effectiveModelReasoningEffort = args.llm
    ? sanitizeModelReasoningEffort(
        getAllModelParameterValues(args.llm.initialParameters, args.llm.userParameters)[args.parameterId],
      )
    : undefined;
  const effectiveModelOption = effectiveModelReasoningEffort
    ? args.options.find(option => option.value === effectiveModelReasoningEffort) ?? null
    : null;

  const modelSettingLabel = effectiveModelOption?.label
    ?? (effectiveModelReasoningEffort ? PARTICIPANT_REASONING_EFFORT_META[effectiveModelReasoningEffort].label : 'Model default');
  const modelSettingDescription = effectiveModelOption?.description
    ?? (effectiveModelReasoningEffort ? PARTICIPANT_REASONING_EFFORT_META[effectiveModelReasoningEffort].description : 'Provider/model default');

  return {
    selectValue: selectedOption?.value ?? PARTICIPANT_REASONING_MODEL_SETTING_VALUE,
    helperText: selectedOption?.description ?? `Using model setting: ${modelSettingLabel}. ${modelSettingDescription}`,
    modelSettingLabel,
  };
}
