import type { DLLM } from '~/common/stores/llms/llms.types';
import {
  DModelParameterRegistry,
  DModelReasoningEffort,
  findModelReasoningEffortParamSpec,
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

export function getReasoningEffortOptions(llm: DLLM | null) {
  if (!llm)
    return { parameterId: null, parameterLabel: 'Reasoning Effort', options: [] as ParticipantReasoningOption[] };

  const effortSpec = findModelReasoningEffortParamSpec(llm.parameterSpecs);
  if (!effortSpec)
    return { parameterId: null, parameterLabel: 'Reasoning Effort', options: [] as ParticipantReasoningOption[] };

  const parameterId = effortSpec.paramId as DModelReasoningEffortParamId;
  const allowedValues = new Set((effortSpec.enumValues as readonly DModelReasoningEffort[] | undefined)
    ?? (DModelParameterRegistry[parameterId].values as readonly DModelReasoningEffort[]));
  const options = PARTICIPANT_REASONING_EFFORT_ORDER
    .filter(value => allowedValues.has(value))
    .map(value => ({
      value,
      label: PARTICIPANT_REASONING_EFFORT_META[value].label,
      description: PARTICIPANT_REASONING_EFFORT_META[value].description,
    }));

  return {
    parameterId,
    parameterLabel: DModelParameterRegistry[parameterId].label,
    options,
  };
}

export function getParticipantReasoningEffortDraftValue(args: {
  draft: { reasoningEffort: DModelReasoningEffort | null } | null | undefined;
  persistedReasoningEffort: DModelReasoningEffort | null | undefined;
}): DModelReasoningEffort | null {
  if (args.draft && Object.prototype.hasOwnProperty.call(args.draft, 'reasoningEffort'))
    return args.draft.reasoningEffort ?? null;

  return args.persistedReasoningEffort ?? null;
}

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

export function getParticipantReasoningEffortCompactLabel(args: {
  llm: DLLM | null;
  parameterId: DModelReasoningEffortParamId | null;
  options: readonly ParticipantReasoningOption[];
  selectedReasoningEffort: DModelReasoningEffort | null | undefined;
}): string {
  const state = getParticipantReasoningEffortSelectState(args);
  return state.selectValue === PARTICIPANT_REASONING_MODEL_SETTING_VALUE
    ? `Use model setting (${state.modelSettingLabel})`
    : PARTICIPANT_REASONING_EFFORT_META[state.selectValue].label;
}
