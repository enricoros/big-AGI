import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Divider } from '@mui/joy';

import { GoodModal } from '~/common/components/GoodModal';
import { useSettingsStore } from '~/common/state/store-settings';
import { useUIStore } from '~/common/state/store-ui';

import { LLMList } from './LLMList';
import { EditSources } from './EditSources';
import { DModelSourceId, useModelsStore } from '../store-models';
import { configureVendorSource } from '~/modules/llms/vendors-registry';


export function Configurator() {

  // local state
  const [selectedSourceId, setSelectedSourceId] = React.useState<DModelSourceId | null>(null);

  // external state
  const { modelingOpen, openModeling, closeModeling } = useUIStore();
  const { modelSources, llmCount } = useModelsStore(state => ({
    modelSources: state.sources,
    llmCount: state.llms.length,
  }), shallow);

  const { OLD_SKOOL_DEL_apiKey } = useSettingsStore(state => ({ OLD_SKOOL_DEL_apiKey: state.apiKey }), shallow);

  const activeSource = modelSources.find(source => source.sourceId === selectedSourceId);
  const vendorConfigComponent = (activeSource && selectedSourceId) ? configureVendorSource(activeSource.vendorId, selectedSourceId) : null;


  // show the Configuration Dialog at startup if the API key is required but not set
  React.useEffect(() => {
    // if (!hasServerKeyOpenAI && !isValidOpenAIApiKey(apiKey))
    openModeling();
  }, [OLD_SKOOL_DEL_apiKey, openModeling]);

  return (
    <GoodModal title='Configure AI Models' open={modelingOpen} onClose={closeModeling}>

      <EditSources selectedSourceId={selectedSourceId} setSelectedSourceId={setSelectedSourceId} />

      {!!vendorConfigComponent && <Divider />}

      {vendorConfigComponent}

      {!!llmCount && <Divider />}

      {!!llmCount && <LLMList />}

      <Divider />

    </GoodModal>
  );
}