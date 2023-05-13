import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Divider } from '@mui/joy';

import { GoodModal } from '~/common/components/GoodModal';
import { useUIStore } from '~/common/state/store-ui';

import { LLMList } from './LLMList';
import { EditSources } from './EditSources';
import { DModelSource, DModelSourceId, useModelsStore } from '../store-models';
import { configureVendorSource } from '~/modules/llms/vendors-registry';


function SourceConfiguration(props: { source: DModelSource }) {
  return configureVendorSource(props.source.vendorId, props.source.sourceId);
}


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
  const selectedSourceId = _selectedSourceId ?? modelSources[0]?.sourceId ?? null;

  const activeSource = modelSources.find(source => source.sourceId === selectedSourceId);

  // show the Configuration Dialog at startup if the API key is required but not set
  React.useEffect(() => {
    if (!activeSource)
      openModeling();
  }, [activeSource, openModeling]);

  return (
    <GoodModal title='Configure AI Models' open={modelingOpen} onClose={closeModeling}>

      <EditSources selectedSourceId={selectedSourceId} setSelectedSourceId={setSelectedSourceId} />

      {!!activeSource && <Divider />}

      {!!activeSource && <SourceConfiguration source={activeSource} />}

      {!!llmCount && <Divider />}

      {!!llmCount && <LLMList />}

      <Divider />

    </GoodModal>
  );
}