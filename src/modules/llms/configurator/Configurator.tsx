import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Divider } from '@mui/joy';

import { GoodModal } from '~/common/components/GoodModal';
import { useSettingsStore } from '~/common/state/store-settings';
import { useUIStore } from '~/common/state/store-ui';

import { LLMList } from './LLMList';
import { SourceAdd } from './SourceAdd';
import { SourceEdit } from './SourceEdit';
import { useModelsStore } from '../store-models';


export function Configurator() {

  // external state
  const { modelingOpen, openModeling, closeModeling } = useUIStore();
  const { apiKey } = useSettingsStore(state => ({ apiKey: state.apiKey }), shallow);
  const llmCount = useModelsStore(state => state.llms.length);

  // show the Configuration Dialog at startup if the API key is required but not set
  React.useEffect(() => {
    // if (!hasServerKeyOpenAI && !isValidOpenAIApiKey(apiKey))
    openModeling();
  }, [apiKey, openModeling]);

  return (
    <GoodModal title='Configure AI Models' open={modelingOpen} onClose={closeModeling}>

      <SourceAdd />

      <Divider />

      <SourceEdit />

      {/*<Divider />*/}

      {!!llmCount && <LLMList />}

      <Divider />

    </GoodModal>
  );
}