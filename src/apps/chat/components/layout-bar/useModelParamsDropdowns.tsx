import * as React from 'react';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { OptimaBarDropdownMemo, OptimaDropdownItems } from '~/common/layout/optima/bar/OptimaBarDropdown';
import { useAllLLMs } from '~/common/stores/llms/hooks/useAllLLMs';
import { useModelDomain } from '~/common/stores/llms/hooks/useModelDomain';
import { DModelParameterRegistry, getAllModelParameterValues, DModelParameterSpec } from '~/common/stores/llms/llms.parameters';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';
import { VERBOSITY_VALUE_LABELS, REASONING_EFFORT_VALUE_LABELS, REASONING_EFFORT4_VALUE_LABELS } from '~/modules/llms/models-modal/LLMParametersEditor';

const FALLBACK_VERBOSITY = ['low', 'medium', 'high'] as const;
const FALLBACK_REASONING3 = ['low', 'medium', 'high'] as const;
const FALLBACK_REASONING4 = ['minimal', 'low', 'medium', 'high'] as const;

const DEFAULT_KEY = '__default';

const EMPTY_PARAM_SPECS: readonly DModelParameterSpec<any>[] = Object.freeze([]);


function itemsFromEnum(values: readonly string[], withDefault: boolean, labelMap?: Record<string, string>): OptimaDropdownItems {
  const items: OptimaDropdownItems = {};
  for (const v of values) {
    const label = (labelMap && labelMap[v]) || v;
    items[v] = { title: label };
  }
  if (withDefault) {
    items[DEFAULT_KEY] = { title: 'Default' };
  }
  return items;
}

/**
 * Returns conditional dropdowns for model parameters:
 * - Verbosity
 * - Reasoning Effort (3-level or 4-level)
 *
 * Renders only when the currently selected model supports the corresponding parameter.
 */
export function useModelParamsDropdowns(): {
  verbosityDropdown: React.ReactNode | null;
  reasoningDropdown: React.ReactNode | null;
} {

  const llms = useAllLLMs();
  const { domainModelId: chatLLMId } = useModelDomain('primaryChat');
 
  const model = React.useMemo(
    () => llms.find(m => m.id === chatLLMId) ?? null,
    [llms, chatLLMId],
  );
 
  const parameterSpecs = React.useMemo(
    () => model?.parameterSpecs ?? EMPTY_PARAM_SPECS,
    [model],
  );
 
  // support specs
  const verbositySpec = React.useMemo(
    () => parameterSpecs.find(ps => ps.paramId === 'llmVndOaiVerbosity' && !ps.hidden) ?? null,
    [parameterSpecs],
  );
  const reasoning4Spec = React.useMemo(
    () => parameterSpecs.find(ps => ps.paramId === 'llmVndOaiReasoningEffort4' && !ps.hidden) ?? null,
    [parameterSpecs],
  );
  const reasoning3Spec = React.useMemo(
    () => reasoning4Spec ? null : (parameterSpecs.find(ps => ps.paramId === 'llmVndOaiReasoningEffort' && !ps.hidden) ?? null),
    [parameterSpecs, reasoning4Spec],
  );
 
  // effective values (default + initial + user overrides)
  const effectiveValues = React.useMemo(
    () => model ? getAllModelParameterValues(model.initialParameters, model.userParameters) : undefined,
    [model],
  );
 
  // options
  const verbosityOptions = React.useMemo(() => {
    const allowed = (DModelParameterRegistry.llmVndOaiVerbosity)?.values as readonly string[] | undefined;
    return allowed?.length ? allowed : FALLBACK_VERBOSITY;
  }, []);
  const reasoningOptions = React.useMemo(() => {
    if (reasoning4Spec) {
      const allowed = (DModelParameterRegistry.llmVndOaiReasoningEffort4)?.values as readonly string[] | undefined;
      return allowed?.length ? allowed : FALLBACK_REASONING4;
    }
    if (reasoning3Spec) {
      const allowed = (DModelParameterRegistry.llmVndOaiReasoningEffort)?.values as readonly string[] | undefined;
      return allowed?.length ? allowed : FALLBACK_REASONING3;
    }
    return FALLBACK_REASONING3;
  }, [reasoning4Spec, reasoning3Spec]);
 
  const { updateLLMUserParameters, deleteLLMUserParameter } = llmsStoreActions();

  // dropdown verbosity
  const verbosityDropdown = React.useMemo(() => {
    if (!model || !verbositySpec || !effectiveValues) return null;
 
    const items = itemsFromEnum(verbosityOptions, true, VERBOSITY_VALUE_LABELS);
    const userValue = model.userParameters?.llmVndOaiVerbosity as (string | undefined);
    const value = (userValue === undefined ? DEFAULT_KEY : userValue) as (string | null);
 
    const onChange = (val: string | null) => {
      if (val === null) return;
      if (val === DEFAULT_KEY) {
        deleteLLMUserParameter(model.id, 'llmVndOaiVerbosity');
      } else {
        updateLLMUserParameters(model.id, {
          llmVndOaiVerbosity: val as typeof DModelParameterRegistry['llmVndOaiVerbosity']['values'][number],
        });
      }
    };
 
    const control = (
      <OptimaBarDropdownMemo
        items={items}
        value={value}
        onChange={onChange}
        placeholder='Verbosity'
      />
    );
 
    return (
      <GoodTooltip title='Verbosity'>
        <span style={{ display: 'inline-block' }}>{control}</span>
      </GoodTooltip>
    );
  }, [model, verbositySpec, effectiveValues, verbosityOptions, updateLLMUserParameters, deleteLLMUserParameter]);

  // dropdown reasoning
  const reasoningParamId = React.useMemo(
    () => reasoning4Spec ? 'llmVndOaiReasoningEffort4' : (reasoning3Spec ? 'llmVndOaiReasoningEffort' : null),
    [reasoning4Spec, reasoning3Spec],
  );
  const reasoningDropdown = React.useMemo(() => {
    if (!model || !effectiveValues || !reasoningParamId) return null;
 
    const items = itemsFromEnum(
      reasoningOptions,
      true,
      reasoningParamId === 'llmVndOaiReasoningEffort4' ? REASONING_EFFORT4_VALUE_LABELS : REASONING_EFFORT_VALUE_LABELS
    );
    const userValue = (model.userParameters)?.[reasoningParamId] as string | undefined;
    const value = (userValue === undefined ? DEFAULT_KEY : userValue) as (string | null);
 
    const onChange = (val: string | null) => {
      if (val === null) return;
      if (val === DEFAULT_KEY) {
        deleteLLMUserParameter(model.id, reasoningParamId);
      } else {
        if (reasoningParamId === 'llmVndOaiReasoningEffort4') {
          updateLLMUserParameters(model.id, {
            llmVndOaiReasoningEffort4: val as typeof DModelParameterRegistry['llmVndOaiReasoningEffort4']['values'][number],
          });
        } else if (reasoningParamId === 'llmVndOaiReasoningEffort') {
          updateLLMUserParameters(model.id, {
            llmVndOaiReasoningEffort: val as typeof DModelParameterRegistry['llmVndOaiReasoningEffort']['values'][number],
          });
        }
      }
    };
 
    const control = (
      <OptimaBarDropdownMemo
        items={items}
        value={value}
        onChange={onChange}
        placeholder='Reasoning'
      />
    );
 
    return (
      <GoodTooltip title={reasoningParamId === 'llmVndOaiReasoningEffort4' ? 'Reasoning Effort (4-level scale)' : 'Reasoning Effort (3-level scale)'}>
        <span style={{ display: 'inline-block' }}>{control}</span>
      </GoodTooltip>
    );
  }, [model, effectiveValues, reasoningParamId, reasoningOptions, updateLLMUserParameters, deleteLLMUserParameter]);
 
  return { verbosityDropdown, reasoningDropdown };
}