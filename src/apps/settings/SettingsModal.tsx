import * as React from 'react';

import { Box, Button, Divider } from '@mui/joy';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';

import { ElevenlabsSettings } from '~/modules/elevenlabs/ElevenlabsSettings';
import { ProdiaSettings } from '~/modules/prodia/ProdiaSettings';
import { SearchSettings } from '~/modules/search/SearchSettings';
import { GoodModal } from '~/common/components/GoodModal';
import { useUIStore } from '~/common/state/store-ui';

import { UISettings } from './UISettings';

/**
 * Component that allows the User to modify the application settings,
 * persisted on the client via localStorage.
 */
export function SettingsModal() {
  // external state
  const { settingsOpen, closeSettings, openModelsSetup } = useUIStore();

  return (
    <GoodModal title={`Preferences`} open={settingsOpen} onClose={closeSettings}
               startButton={
                 <Button variant='plain' color='info' onClick={openModelsSetup} startDecorator={<BuildCircleIcon />}>
                   Models
                 </Button>
               }
               sx={{ p: { xs: 1, sm: 2, lg: 2.5 } }}>

      <Divider />

      <Box>

        <UISettings />

        <ElevenlabsSettings />

        <ProdiaSettings />

        <SearchSettings />

      </Box>

      <Divider />

    </GoodModal>
  );
}
