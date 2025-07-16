import * as React from 'react';

import { optimaActions, useOptimaModals } from '~/common/layout/optima/useOptima';
import { useModelsServices } from '~/common/stores/llms/llms.hooks';

import { LLMOptionsModal } from './LLMOptionsModal';
import { ModelsConfiguratorModal } from './ModelsConfiguratorModal';


/**
 * This is here so we can lazy-load the ModelsModals component, which includes two medium-heavy modals.
 */
export function ModelsModals() {

  // external state
  const { showModels, showModelOptions } = useOptimaModals();
  const { modelsServices, confServiceId, setConfServiceId } = useModelsServices();


  return <>

    {/* Services Setup */}
    {showModels && (
      <ModelsConfiguratorModal
        modelsServices={modelsServices}
        confServiceId={confServiceId}
        setConfServiceId={setConfServiceId}
      />
    )}

    {/* per-LLM options */}
    {!!showModelOptions && (
      <LLMOptionsModal id={showModelOptions} onClose={optimaActions().closeModelOptions} />
    )}

  </>;
}
