import * as React from 'react';

import { Accordion, AccordionDetails, accordionDetailsClasses, AccordionGroup, AccordionSummary, accordionSummaryClasses, Avatar, Button, Divider, ListItemContent, Stack, styled, Tab, tabClasses, TabList, TabPanel, Tabs } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import ScienceIcon from '@mui/icons-material/Science';
import SearchIcon from '@mui/icons-material/Search';

import { BrowseSettings } from '~/modules/browse/BrowseSettings';
import { ElevenlabsSettings } from '~/modules/elevenlabs/ElevenlabsSettings';
import { GoogleSearchSettings } from '~/modules/google/GoogleSearchSettings';
import { ProdiaSettings } from '~/modules/prodia/ProdiaSettings';

import { GoodModal } from '~/common/components/GoodModal';
import { closeLayoutPreferences, openLayoutShortcuts, useLayoutPreferencesTab } from '~/common/layout/store-applayout';
import { settingsGap } from '~/common/app.theme';
import { useIsMobile } from '~/common/components/useMatchMedia';

import { AppChatSettingsAI } from './AppChatSettingsAI';
import { AppChatSettingsUI } from './AppChatSettingsUI';
import { UxLabsSettings } from './UxLabsSettings';
import { VoiceSettings } from './VoiceSettings';


// styled <AccordionGroup variant='plain'> into a Topics component
const Topics = styled(AccordionGroup)(({ theme }) => ({
  // round and clip corners
  borderRadius: theme.radius.md, overflow: 'hidden',

  // larger summary, with a spinning icon
  [`& .${accordionSummaryClasses.button}`]: {
    minHeight: 64,
  },
  [`& .${accordionSummaryClasses.indicator}`]: {
    transition: '0.2s',
  },
  [`& [aria-expanded="true"] .${accordionSummaryClasses.indicator}`]: {
    transform: 'rotate(45deg)',
  },

  // larger padded block
  [`& .${accordionDetailsClasses.content}.${accordionDetailsClasses.expanded}`]: {
    paddingBlock: '1rem',
  },
}));

function Topic(props: { title?: string, icon?: string | React.ReactNode, startCollapsed?: boolean, children?: React.ReactNode }) {

  // state
  const [expanded, setExpanded] = React.useState(props.startCollapsed !== true);

  // derived state
  const hideTitleBar = !props.title && !props.icon;

  return (
    <Accordion
      expanded={expanded || hideTitleBar}
      onChange={(_event, expanded) => setExpanded(expanded)}
      sx={{
        '&:not(:last-child)': {
          borderBottomColor: 'primary.softActiveBg',
        },
        '&:last-child': {
          borderBottom: 'none',
        },
      }}
    >

      {!hideTitleBar && (
        <AccordionSummary
          color='primary'
          variant={expanded ? 'plain' : 'soft'}
          indicator={<AddIcon />}
        >
          {!!props.icon && (
            <Avatar
              color='primary'
              variant={expanded ? 'soft' : 'plain'}
            >
              {props.icon}
            </Avatar>
          )}
          <ListItemContent>
            {props.title}
          </ListItemContent>
        </AccordionSummary>
      )}

      <AccordionDetails>
        <Stack sx={{ gap: settingsGap, border: 'none' }}>
          {props.children}
        </Stack>
      </AccordionDetails>

    </Accordion>
  );
}


/**
 * Component that allows the User to modify the application settings,
 * persisted on the client via localStorage.
 */
export function SettingsModal() {

  // external state
  const isMobile = useIsMobile();
  const settingsTabIndex = useLayoutPreferencesTab();

  const tabFixSx = { fontFamily: 'body', flex: 1, p: 0, m: 0 };

  return (
    <GoodModal
      title='Preferences' strongerTitle
      open={!!settingsTabIndex} onClose={closeLayoutPreferences}
      startButton={isMobile ? undefined : (
        <Button variant='soft' onClick={openLayoutShortcuts}>
          👉 See Shortcuts
        </Button>
      )}
      sx={{
        '--Card-padding': { xs: '8px', sm: '16px', lg: '24px' },
      }}
    >

      <Divider />

      <Tabs aria-label='Settings tabbed menu' defaultValue={settingsTabIndex}>
        <TabList
          variant='soft'
          disableUnderline
          sx={{
            '--ListItem-minHeight': '2.4rem',
            bgcolor: 'primary.softHoverBg',
            mb: 2,
            p: 0.5,
            borderRadius: 'md',
            fontSize: 'md',
            gap: 1,
            overflow: 'hidden',
            [`& .${tabClasses.root}[aria-selected="true"]`]: {
              color: 'primary.plainColor',
              bgcolor: 'background.surface',
              boxShadow: 'lg',
              fontWeight: 'md',
            },
          }}
        >
          <Tab disableIndicator value={1} sx={tabFixSx}>Chat</Tab>
          <Tab disableIndicator value={3} sx={tabFixSx}>Voice</Tab>
          <Tab disableIndicator value={2} sx={tabFixSx}>Draw</Tab>
          <Tab disableIndicator value={4} sx={tabFixSx}>Tools</Tab>
        </TabList>

        <TabPanel value={1} sx={{ p: 'var(--Tabs-gap)' }}>
          <Topics>
            <Topic>
              <AppChatSettingsUI />
            </Topic>
            <Topic icon='🧠' title='Chat AI' startCollapsed>
              <AppChatSettingsAI />
            </Topic>
            <Topic icon={<ScienceIcon />} title='Labs' startCollapsed>
              <UxLabsSettings />
            </Topic>
          </Topics>
        </TabPanel>

        <TabPanel value={3} sx={{ p: 'var(--Tabs-gap)' }}>
          <Topics>
            <Topic icon='🎙️' title='Voice settings'>
              <VoiceSettings />
            </Topic>
            <Topic icon='📢' title='ElevenLabs API'>
              <ElevenlabsSettings />
            </Topic>
          </Topics>
        </TabPanel>

        <TabPanel value={2} sx={{ p: 'var(--Tabs-gap)' }}>
          <Topics>
            <Topic icon='🖍️️' title='Prodia API'>
              <ProdiaSettings />
            </Topic>
          </Topics>
        </TabPanel>

        <TabPanel value={4} sx={{ p: 'var(--Tabs-gap)' }}>
          <Topics>
            <Topic icon={<SearchIcon />} title='Browsing' startCollapsed>
              <BrowseSettings />
            </Topic>
            <Topic icon={<SearchIcon />} title='Google Search API' startCollapsed>
              <GoogleSearchSettings />
            </Topic>
            {/*<Topic icon='🛠' title='Other tools...' />*/}
          </Topics>
        </TabPanel>
      </Tabs>

      <Divider />

    </GoodModal>
  );
}
