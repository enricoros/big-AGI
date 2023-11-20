import * as React from 'react';

import { Accordion, AccordionDetails, accordionDetailsClasses, AccordionGroup, AccordionSummary, accordionSummaryClasses, Avatar, Button, Divider, ListItemContent, Stack, styled, Tab, tabClasses, TabList, TabPanel, Tabs } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import ScienceIcon from '@mui/icons-material/Science';
import SearchIcon from '@mui/icons-material/Search';
import TelegramIcon from '@mui/icons-material/Telegram';

import { ElevenlabsSettings } from '~/modules/elevenlabs/ElevenlabsSettings';
import { GoogleSearchSettings } from '~/modules/google/GoogleSearchSettings';
import { ProdiaSettings } from '~/modules/prodia/ProdiaSettings';

import { GoodModal } from '~/common/components/GoodModal';
import { closeLayoutPreferences, openLayoutModelsSetup, openLayoutPreferences, useLayoutPreferencesTab } from '~/common/layout/store-applayout';
import { settingsGap } from '~/common/app.theme';
import { useGlobalShortcut } from '~/common/components/useGlobalShortcut';

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

function Topic(props: { title: string, icon?: string | React.ReactNode, startCollapsed?: boolean, children?: React.ReactNode }) {

  // state
  const [expanded, setExpanded] = React.useState(props.startCollapsed !== true);

  return (
    <Accordion
      expanded={expanded}
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
  const settingsTabIndex = useLayoutPreferencesTab();
  useGlobalShortcut('p', true, true, false, openLayoutPreferences);

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
          <Tab disableIndicator value={1} sx={tabFixSx}>UX</Tab>
          <Tab disableIndicator value={3} sx={tabFixSx}>Voice</Tab>
          <Tab disableIndicator value={2} sx={tabFixSx}>Draw</Tab>
          <Tab disableIndicator value={4} sx={tabFixSx}>Tools</Tab>
        </TabList>

        <TabPanel value={1} sx={{ p: 'var(--Tabs-gap)' }}>
          <Topics>
            <Topic icon={<TelegramIcon />} title='User Interface'>
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
            <Topic icon={<SearchIcon />} title='Google Search API'>
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
