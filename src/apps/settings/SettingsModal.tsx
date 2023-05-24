import * as React from 'react';

import { Button, Divider, Tab, TabList, TabPanel, Tabs } from '@mui/joy';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';

import { ElevenlabsSettings } from '~/modules/elevenlabs/ElevenlabsSettings';
import { ProdiaSettings } from '~/modules/prodia/ProdiaSettings';

import { GoodModal } from '~/common/components/GoodModal';
import { useUIStateStore } from '~/common/state/store-ui';

import { ToolsSettings } from './ToolsSettings';
import { UISettings } from './UISettings';


/**
 * Component that allows the User to modify the application settings,
 * persisted on the client via localStorage.
 */
export function SettingsModal() {
  // external state
  const { settingsOpenTab, closeSettings, openModelsSetup } = useUIStateStore();

  return (
    <GoodModal title={`Preferences`} open={!!settingsOpenTab} onClose={closeSettings}
               startButton={
                 <Button variant='plain' color='info' onClick={openModelsSetup} startDecorator={<BuildCircleIcon />}>
                   Models
                 </Button>
               }
               sx={{ p: { xs: 1, sm: 2, lg: 2.5 } }}>

      {/*<Divider />*/}

      <Tabs aria-label='Settings tabbed menu' defaultValue={settingsOpenTab} sx={{ borderRadius: 'lg' }}>
        <TabList variant='soft' color='neutral' sx={{ mb: 2 /* gap: 3, minus 0.5 for the Tabs-gap, minus 0.5 for perception */ }}>
          <Tab value={1}>UI</Tab>
          <Tab value={2}>Draw</Tab>
          <Tab value={3}>Speak</Tab>
          <Tab value={4}>Tools</Tab>
        </TabList>

        <TabPanel value={1} sx={{ p: 'var(--Tabs-gap)' }}>
          <UISettings />
        </TabPanel>

        <TabPanel value={2} sx={{ p: 'var(--Tabs-gap)' }}>
          <ProdiaSettings />
        </TabPanel>

        <TabPanel value={3} sx={{ p: 'var(--Tabs-gap)' }}>
          <ElevenlabsSettings />
        </TabPanel>

        <TabPanel value={4} sx={{ p: 'var(--Tabs-gap)' }}>
          <ToolsSettings />
        </TabPanel>
      </Tabs>

      <Divider />

    </GoodModal>
  );
}
