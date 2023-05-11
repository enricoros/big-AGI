import * as React from 'react';

import { Box, Button } from '@mui/joy';

import { ElevenlabsSettings } from '@/modules/elevenlabs/ElevenlabsSettings';
import { OpenAIAdvancedSettings } from '@/modules/openai/OpenAIAdvancedSettings';
import { OpenAISettings } from '@/modules/openai/OpenAISettings';
import { ProdiaSettings } from '@/modules/prodia/ProdiaSettings';
import { SearchSettings } from '@/modules/search/SearchSettings';

import { GoodModal } from '@/common/components/GoodModal';
import { useUIStore } from '@/common/state/store-ui';

import { UISettings } from './UISettings';

/**
 * Component that allows the User to modify the application settings,
 * persisted on the client via localStorage.
 */
export function SettingsModal() {
  // external state
  const { settingsOpen, closeSettings, openModeling } = useUIStore();

  return (
    <GoodModal title='Settings' open={settingsOpen} onClose={closeSettings}
               sx={{ p: { xs: 1, sm: 2, lg: 2.5 } }}>

      <Button size='lg' variant='solid' color='primary' onClick={openModeling}>
        Configure Models
      </Button>

      <Box>

        <OpenAISettings />

        <UISettings />

        <ElevenlabsSettings />

        <ProdiaSettings />

        <SearchSettings />

        <OpenAIAdvancedSettings />

      </Box>

    </GoodModal>
  );
}
