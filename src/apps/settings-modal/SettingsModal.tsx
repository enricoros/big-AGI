import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Accordion, AccordionDetails, accordionDetailsClasses, AccordionGroup, AccordionSummary, accordionSummaryClasses, Avatar, Button, Divider, ListItemContent, Stack, styled, Tab, tabClasses, TabList, TabPanel, Tabs } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import ScienceIcon from '@mui/icons-material/Science';
import SearchIcon from '@mui/icons-material/Search';

import { BrowseSettings } from '~/modules/browse/BrowseSettings';
import { DallESettings } from '~/modules/t2i/dalle/DallESettings';
import { ElevenlabsSettings } from '~/modules/elevenlabs/ElevenlabsSettings';
import { GoogleSearchSettings } from '~/modules/google/GoogleSearchSettings';
import { ProdiaSettings } from '~/modules/t2i/prodia/ProdiaSettings';
import { T2ISettings } from '~/modules/t2i/T2ISettings';

import { GoodModal } from '~/common/components/GoodModal';
import { PreferencesTab } from '~/common/layout/optima/useOptimaLayout';
import { useIsMobile } from '~/common/components/useMatchMedia';

import { AppChatSettingsAI } from './AppChatSettingsAI';
import { AppChatSettingsUI } from './settings-ui/AppChatSettingsUI';
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
        <Stack sx={{ gap: 'calc(var(--Card-padding) / 2)', border: 'none' }}>
          {props.children}
        </Stack>
      </AccordionDetails>

    </Accordion>
  );
}


const settingTaxSx: SxProps = {
  fontFamily: 'body',
  flex: 1,
  p: 0,
  m: 0,
};

/**
 * Component that allows the User to modify the application settings,
 * persisted on the client via localStorage.
 */
export function SettingsModal(props: {
  open: boolean,
  tabIndex: number,
  onClose: () => void,
  onOpenShortcuts: () => void,
}) {

  // external state
  const isMobile = useIsMobile();

  return (
    <GoodModal
      title='Preferences' strongerTitle
      open={props.open} onClose={props.onClose}
      startButton={isMobile ? undefined : (
        <Button variant='soft' onClick={props.onOpenShortcuts}>
          👉 See Shortcuts
        </Button>
      )}
    >

      <Divider />

      <Tabs aria-label='Settings tabbed menu' defaultValue={props.tabIndex}>
        <TabList
          disableUnderline
          sx={{
            bgcolor: 'primary.softHoverBg',
            mb: 2,
            p: 0.5,
            borderRadius: 'md',
            fontSize: 'md',
            fontWeight: 'md',
            gap: 1,
            overflow: 'hidden',
            [`& .${tabClasses.root}[aria-selected="true"]`]: {
              // color: 'primary.plainColor',
              borderRadius: 'sm',
              bgcolor: 'background.popup',
              boxShadow: 'sm',
              fontWeight: 'lg',
            },
          }}
        >
          <Tab disableIndicator value={PreferencesTab.Chat} sx={settingTaxSx}>Chat</Tab>
          <Tab disableIndicator value={PreferencesTab.Voice} sx={settingTaxSx}>Voice</Tab>
          <Tab disableIndicator value={PreferencesTab.Draw} sx={settingTaxSx}>Draw</Tab>
          <Tab disableIndicator value={PreferencesTab.Tools} sx={settingTaxSx}>Tools</Tab>
        </TabList>

        <TabPanel value={PreferencesTab.Chat} variant='outlined' sx={{ p: 'var(--Tabs-gap)', borderRadius: 'md' }}>
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

        <TabPanel value={PreferencesTab.Voice} variant='outlined' sx={{ p: 'var(--Tabs-gap)', borderRadius: 'md' }}>
          <Topics>
            <Topic icon='🎙️' title='Voice settings'>
              <VoiceSettings />
            </Topic>
            <Topic icon='📢' title='ElevenLabs API'>
              <ElevenlabsSettings />
            </Topic>
          </Topics>
        </TabPanel>

        <TabPanel value={PreferencesTab.Draw} variant='outlined' sx={{ p: 'var(--Tabs-gap)', borderRadius: 'md' }}>
          <Topics>
            <Topic>
              <T2ISettings />
            </Topic>
            <Topic icon='🖍️️' title='OpenAI DALL·E' startCollapsed>
              <DallESettings />
            </Topic>
            <Topic icon='🖍️️' title='Prodia API' startCollapsed>
              <ProdiaSettings noSkipKey />
            </Topic>
          </Topics>
        </TabPanel>

        <TabPanel value={PreferencesTab.Tools} variant='outlined' sx={{ p: 'var(--Tabs-gap)', borderRadius: 'md' }}>
          <Topics>
            <Topic icon={<SearchIcon />} title='Browsing'>
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
