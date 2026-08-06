import * as React from 'react';

import { DLLM, getLLMMaxOutputTokens, LLM_IF_HOTFIX_NoTemperature } from '~/common/stores/llms/llms.types';
import type { DModelParameterId, DModelParameterValues } from '~/common/stores/llms/llms.parameters';
import { InlineError } from '~/common/components/InlineError';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';

import { LLMParametersEditor } from './LLMParametersEditor';


export function LLMOptionsGlobal(props: { llm: DLLM }) {

  // derived input
  const llm = props.llm;
  const llmId = llm?.id ?? null;

  // handlers

  const handleChangeParameter = React.useCallback((partial: Partial<DModelParameterValues>) => {
    llmsStoreActions().updateLLMUserParameters(llmId, partial);
  }, [llmId]);

  const handleRemoveParameter = React.useCallback((parameterId: DModelParameterId) => {
    llmsStoreActions().deleteLLMUserParameter(llmId, parameterId);
  }, [llmId]);


  if (!llmId)
    return <InlineError error='No model selected' />;

  return (
    <LLMParametersEditor
      maxOutputTokens={getLLMMaxOutputTokens(llm) ?? null}
      parameterSpecs={llm.parameterSpecs}
      parameterOmitTemperature={llm.interfaces.includes(LLM_IF_HOTFIX_NoTemperature)}
      baselineParameters={llm.initialParameters}
      parameters={llm.userParameters}
      onChangeParameter={handleChangeParameter}
      onRemoveParameter={handleRemoveParameter}
    />
  );
}