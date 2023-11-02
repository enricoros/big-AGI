import * as React from 'react';

import { Button, Divider, Tab, TabList, TabPanel, Tabs } from '@mui/joy';
import { tabClasses } from '@mui/joy/Tab';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';

import { ElevenlabsSettings } from '~/modules/elevenlabs/ElevenlabsSettings';
import { ProdiaSettings } from '~/modules/prodia/ProdiaSettings';

import { GoodModal } from '~/common/components/GoodModal';
import { closeLayoutPreferences, openLayoutModelsSetup, openLayoutPreferences, useLayoutPreferencesTab } from '~/common/layout/store-applayout';
import { useGlobalShortcut } from '~/common/components/useGlobalShortcut';

import { ToolsSettings } from './ToolsSettings';
import { UISettings } from './UISettings';


/**
 * Component that allows the User to modify the application settings,
 * persisted on the client via localStorage.
 */
export function SettingsModal() {

  // external state
  const settingsTabIndex = useLayoutPreferencesTab();
  useGlobalShortcut('p', true, true, openLayoutPreferences);

  const tabFixSx = { fontFamily: 'body', flex: 1, p: 0, m: 0 };

  return (
    <GoodModal
      title='Preferences' strongerTitle
      open={!!settingsTabIndex} onClose={closeLayoutPreferences}
      startButton={
        <Button variant='soft' color='success' onClick={openLayoutModelsSetup} startDecorator={<BuildCircleIcon />} sx={{
          '--Icon-fontSize': 'var(--joy-fontSize-xl2)',
        }}>
          Models
        </Button>
      }
      sx={{ p: { xs: 1, sm: 2, lg: 2.5 } }}
    >

      {/*<Divider />*/}

      <Tabs aria-label='Settings tabbed menu' defaultValue={settingsTabIndex}>
        <TabList
          variant='soft'
          disableUnderline
          sx={{
            '--ListItem-minHeight': '2.4rem',
            bgcolor: 'background.level2',
            mb: 2,
            p: 0.5,
            borderRadius: 'lg',
            fontSize: 'md',
            gap: 1,
            overflow: 'hidden',
            [`& .${tabClasses.root}[aria-selected="true"]`]: {
              bgcolor: 'background.surface',
              boxShadow: 'md',
              fontWeight: 'lg',
            },
          }}
        >
          <Tab disableIndicator value={1} sx={tabFixSx}>Chat</Tab>
          <Tab disableIndicator value={2} sx={tabFixSx}>Draw</Tab>
          <Tab disableIndicator value={3} sx={tabFixSx}>Speak</Tab>
          <Tab disableIndicator value={4} sx={tabFixSx}>Tools</Tab>
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
