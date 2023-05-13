import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Divider } from '@mui/joy';

import { GoodModal } from '@/common/components/GoodModal';
import { useSettingsStore } from '@/common/state/store-settings';
import { useUIStore } from '@/common/state/store-ui';

import { AddVendor } from './AddVendor';
import { ConfigureSources } from './ConfigureSources';
import { EditModels } from '@/modules/models/EditModels';


export function ModelsModal() {

  // external state
  const { modelingOpen, openModeling, closeModeling } = useUIStore();
  const { apiKey } = useSettingsStore(state => ({ apiKey: state.apiKey }), shallow);

  // show the Configuration Dialog at startup if the API key is required but not set
  React.useEffect(() => {
    // if (!hasServerKeyOpenAI && !isValidOpenAIApiKey(apiKey))
    openModeling();
  }, [apiKey, openModeling]);

  return (
    <GoodModal title='Configure AI Models' open={modelingOpen} onClose={closeModeling}>

      <AddVendor />

      <Divider />

      <ConfigureSources />

      <Divider />

      {/*<OpenAISource />*/}

      <EditModels />

      <Divider />


    </GoodModal>
  );
}