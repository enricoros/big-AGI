import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Divider } from '@mui/joy';

import { GoodModal } from '~/common/components/GoodModal';
import { useUIStore } from '~/common/state/store-ui';

import { DModelSourceId } from '../llm.types';
import { EditSources } from './EditSources';
import { ListLLMs } from './ListLLMs';
import { SetupSource } from './SetupSource';
import { createDefaultSource } from '../vendors/vendor.registry';
import { useModelsStore } from '../llm.store';


export function Configurator() {

  // local state
  const [_selectedSourceId, setSelectedSourceId] = React.useState<DModelSourceId | null>(null);

  // external state
  const { modelingOpen, openModeling, closeModeling } = useUIStore();
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
      openModeling();
  }, [selectedSourceId, openModeling]);

  // add the default source on cold - will require setup
  React.useEffect(() => {
    const { addSource, sources } = useModelsStore.getState();
    if (!sources.length)
      addSource(createDefaultSource(sources));
  }, []);


  return (
    <GoodModal title='Configure AI Models' open={modelingOpen} onClose={closeModeling}>

      <EditSources selectedSourceId={selectedSourceId} setSelectedSourceId={setSelectedSourceId} />

      {!!activeSource && <Divider />}

      {!!activeSource && <SetupSource source={activeSource} />}

      {!!llmCount && <Divider />}

      {!!llmCount && <ListLLMs />}

      <Divider />

    </GoodModal>
  );
}