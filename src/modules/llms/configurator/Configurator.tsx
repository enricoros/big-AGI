import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Divider } from '@mui/joy';

import { GoodModal } from '~/common/components/GoodModal';
import { useUIStateStore } from '~/common/state/store-ui';

import { DModelSourceId } from '../llm.types';
import { EditSources } from './EditSources';
import { LLMList } from './LLMList';
import { LLMOptions } from './LLMOptions';
import { VendorSourceSetup } from './VendorSourceSetup';
import { createDefaultModelSource } from '../vendor.registry';
import { useModelsStore } from '../store-llms';


export function Configurator() {

  // local state
  const [_selectedSourceId, setSelectedSourceId] = React.useState<DModelSourceId | null>(null);

  // external state
  const { modelsSetupOpen, openModelsSetup, closeModelsSetup, llmOptionsId } = useUIStateStore();
  const { modelSources, llmCount } = useModelsStore(state => ({
    modelSources: state.sources,
    llmCount: state.llms.length,
  }), shallow);

  // auto-select the first source - note: we could use a useEffect() here, but this is more efficient
  // also note that state-persistence is unneeded
  const selectedSourceId = _selectedSourceId ?? modelSources[0]?.id ?? null;

  const activeSource = modelSources.find(source => source.id === selectedSourceId);


  // if no sources at startup, open the modal
  React.useEffect(() => {
    if (!selectedSourceId)
      openModelsSetup();
  }, [selectedSourceId, openModelsSetup]);

  // add the default source on cold - will require setup
  React.useEffect(() => {
    const { addSource, sources } = useModelsStore.getState();
    if (!sources.length)
      addSource(createDefaultModelSource(sources));
  }, []);


  return <>

    {/* Sources Setup */}
    <GoodModal title={<>Configure <b>AI Models</b></>} open={modelsSetupOpen} onClose={closeModelsSetup}>

      <EditSources selectedSourceId={selectedSourceId} setSelectedSourceId={setSelectedSourceId} />

      {!!activeSource && <Divider />}

      {!!activeSource && <VendorSourceSetup source={activeSource} />}

      {!!llmCount && <Divider />}

      {!!llmCount && <LLMList />}

      <Divider />

    </GoodModal>

    {/* per-LLM options */}
    {!!llmOptionsId && <LLMOptions id={llmOptionsId} />}

  </>;
}