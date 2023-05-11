import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { GoodModal } from '@/common/components/GoodModal';
import { useSettingsStore } from '@/common/state/store-settings';
import { useUIStore } from '@/common/state/store-ui';

import { Modeling } from './Modeling';


export function ModelingModal() {

  // external state
  const { modelingOpen, openModeling, closeModeling } = useUIStore();
  const { apiKey } = useSettingsStore(state => ({ apiKey: state.apiKey }), shallow);

  // show the Configuration Dialog at startup if the API key is required but not set
  React.useEffect(() => {
    // if (requireUserKeyOpenAI && !isValidOpenAIApiKey(apiKey))
    openModeling();
  }, [apiKey, openModeling]);

  return (
    <GoodModal title='Models Setup' open={modelingOpen} onClose={closeModeling}>
      <Modeling />
    </GoodModal>
  );
}