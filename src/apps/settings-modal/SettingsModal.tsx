import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Accordion, AccordionDetails, accordionDetailsClasses, AccordionGroup, AccordionSummary, accordionSummaryClasses, Avatar, Box, Button, Divider, ListItemContent, styled, Tab, tabClasses, TabList, TabPanel, Tabs } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import ScienceIcon from '@mui/icons-material/Science';
import SearchIcon from '@mui/icons-material/Search';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { BrowseSettings } from '~/modules/browse/BrowseSettings';
import { DallESettings } from '~/modules/t2i/dalle/DallESettings';
import { ElevenlabsSettings } from '~/modules/elevenlabs/ElevenlabsSettings';
import { GoogleSearchSettings } from '~/modules/google/GoogleSearchSettings';
import { ProdiaSettings } from '~/modules/t2i/prodia/ProdiaSettings';
import { T2ISettings } from '~/modules/t2i/T2ISettings';

import type { PreferencesTabId } from '~/common/layout/optima/store-layout-optima';
import { DarkModeToggleButton } from '~/common/components/DarkModeToggleButton';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { useIsMobile } from '~/common/components/useMatchMedia';

import { AppChatSettingsAI } from './AppChatSettingsAI';
import { AppChatSettingsUI } from './settings-ui/AppChatSettingsUI';
import { UxLabsSettings } from './UxLabsSettings';
import { VoiceSettings } from './VoiceSettings';


// styled <AccordionGroup variant='plain'> into a Topics component
const Topics = styled(AccordionGroup)({
  // round and clip corners
  borderRadius: 'var(--joy-radius-md)',
  overflow: 'hidden',

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
});

function Topic(props: { title?: React.ReactNode, icon?: string | React.ReactNode, startCollapsed?: boolean, children?: React.ReactNode }) {

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
        <Box sx={{ display: 'grid', gap: 1.5 /* keep in sync with ProviderConfigure > ExpanderControlledBox > Card > CardContent (Draw App) */ }}>
          {props.children}
        </Box>
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
  tab: PreferencesTabId,
  setTab: (index: PreferencesTabId) => void,
  onClose: () => void,
  onOpenShortcuts: () => void,
}) {

  // external state
  const isMobile = useIsMobile();

  // handlers

  const { setTab } = props;

  const handleSetTab = React.useCallback((_event: any, value: string | number | null) => {
    setTab((value ?? undefined) as PreferencesTabId);
  }, [setTab]);

  return (
    <GoodModal
      title='Preferences' strongerTitle
      open={props.open} onClose={props.onClose}
      startButton={isMobile ? undefined : (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <DarkModeToggleButton hasText={true} />
          <Button variant='soft' color='neutral' onClick={props.onOpenShortcuts}>
            👉 See Shortcuts
          </Button>
        </Box>
      )}
    >

      <Divider />

      <Tabs
        aria-label='Settings tabbed menu'
        value={props.tab || 'chat'}
        onChange={handleSetTab}
      >
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
          <Tab disableIndicator value='chat' sx={settingTaxSx}>Chat</Tab>
          <Tab disableIndicator value='voice' sx={settingTaxSx}>Voice</Tab>
          <Tab disableIndicator value='draw' sx={settingTaxSx}>Draw</Tab>
          <Tab disableIndicator value='tools' sx={settingTaxSx}>Tools</Tab>
        </TabList>

        <TabPanel value='chat' variant='outlined' sx={{ p: 'var(--Tabs-gap)', borderRadius: 'md' }}>
          <Topics>
            <Topic>
              <AppChatSettingsUI />
            </Topic>
            <Topic icon='🧠' title={<>Chat AI <WarningRoundedIcon sx={{ ml: 1, color: 'orangered' }} /></>} startCollapsed>
              <AppChatSettingsAI />
            </Topic>
            <Topic icon={<ScienceIcon />} title='Labs' startCollapsed>
              <UxLabsSettings />
            </Topic>
          </Topics>
        </TabPanel>

        <TabPanel value='voice' variant='outlined' sx={{ p: 'var(--Tabs-gap)', borderRadius: 'md' }}>
          <Topics>
            <Topic icon='🎙️' title='Voice settings'>
              <VoiceSettings />
            </Topic>
            <Topic icon='📢' title='ElevenLabs API'>
              <ElevenlabsSettings />
            </Topic>
          </Topics>
        </TabPanel>

        <TabPanel value='draw' variant='outlined' sx={{ p: 'var(--Tabs-gap)', borderRadius: 'md' }}>
          <Topics>
            <Topic>
              <T2ISettings />
            </Topic>
            <Topic icon='🖍️️' title='OpenAI DALL·E'>
              <DallESettings />
            </Topic>
            <Topic icon='🖍️️' title='Prodia API' startCollapsed>
              <ProdiaSettings noSkipKey />
            </Topic>
          </Topics>
        </TabPanel>

        <TabPanel value='tools' variant='outlined' sx={{ p: 'var(--Tabs-gap)', borderRadius: 'md' }}>
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
