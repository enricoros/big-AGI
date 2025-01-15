import * as React from 'react';
import { Accordion, AccordionDetails, accordionDetailsClasses, AccordionGroup, AccordionSummary, accordionSummaryClasses, Avatar, Box, Button, ListItemContent, styled, Tab, TabList, TabPanel, Tabs } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import MicIcon from '@mui/icons-material/Mic';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import ScienceIcon from '@mui/icons-material/Science';
import SearchIcon from '@mui/icons-material/Search';

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


// configuration
const COLOR_TAB_LIST = 'primary';
const TAB_RADIUS = 'md';


// styled <AccordionGroup variant='plain'> into a Topics component
const Topics = styled(AccordionGroup)({
  // round and clip corners
  borderRadius: `calc(var(--joy-radius-${TAB_RADIUS}) - 1px)`, // compensates for a half-pixel weirdness
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
              color={COLOR_TAB_LIST}
              variant={expanded ? 'plain' /* was: soft */ : 'plain'}
              // size='sm'
            >
              {props.icon}
            </Avatar>
          )}
          <ListItemContent sx={{ color: `${COLOR_TAB_LIST}.softColor` }}>
            {props.title}
          </ListItemContent>
        </AccordionSummary>
      )}

      <AccordionDetails
        slotProps={{
          content: {
            sx: {
              px: { xs: 1.5, md: 2 },
            },
          },
        }}
      >
        <Box sx={{
          display: 'grid',
          gap: 2, // keep in sync with ProviderConfigure > ExpanderControlledBox > Card > CardContent (Draw App)
        }}>
          {props.children}
        </Box>
      </AccordionDetails>

    </Accordion>
  );
}


const _styles = {

  // modal: undefined,
  modal: {
    backgroundColor: 'background.level1',
  } as const,

  tabs: {
    backgroundColor: 'transparent',
  } as const,

  tabsList: {
    backgroundColor: `${COLOR_TAB_LIST}.softHoverBg`,
    mb: 2,
    p: 0.5,
    borderRadius: TAB_RADIUS,
    fontSize: 'md',
    fontWeight: 'md',
    boxShadow: `inset 1px 1px 4px -3px var(--joy-palette-${COLOR_TAB_LIST}-solidHoverBg)`,
    gap: 0.5,
  } as const,

  tabsListTab: {
    borderRadius: 'sm',
    flex: 1,
    p: 0,
    '&[aria-selected="true"]': {
      // color: 'primary.plainColor',
      bgcolor: 'background.popup',
      boxShadow: 'sm',
      fontWeight: 'lg',
      zIndex: 1,
    } as const,
    '&:hover': {
      backgroundColor: 'background.level1',
    } as const,
  } as const,

  tabPanel: {
    boxShadow: 'xs',
    backgroundColor: 'background.surface',
    borderRadius: TAB_RADIUS,
    p: 0,
    // p: 'var(--Tabs-gap)',
  } as const,

} as const;


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
          <Button size='sm' variant='soft' color='neutral' onClick={props.onOpenShortcuts}>
            👉 Shortcuts
          </Button>
        </Box>
      )}
      sx={_styles.modal}
    >

      {/*<Divider />*/}

      <Tabs
        aria-label='Settings tabbed menu'
        value={props.tab || 'chat'}
        onChange={handleSetTab}
        sx={_styles.tabs}
      >
        <TabList
          disableUnderline
          sx={_styles.tabsList}
        >
          <Tab disableIndicator value='chat' sx={_styles.tabsListTab}>Chat</Tab>
          <Tab disableIndicator value='voice' sx={_styles.tabsListTab}>Voice</Tab>
          <Tab disableIndicator value='draw' sx={_styles.tabsListTab}>Draw</Tab>
          <Tab disableIndicator value='tools' sx={_styles.tabsListTab}>Tools</Tab>
        </TabList>

        <TabPanel value='chat' variant='outlined' sx={_styles.tabPanel}>
          <Topics>
            <Topic>
              <AppChatSettingsUI />
            </Topic>
            <Topic icon={<AutoAwesomeIcon />} title={
              'Chat AI'
              // <>Chat AI <WarningRoundedIcon sx={{ ml: 1, color: 'orangered' }} /></>
            } startCollapsed>
              <AppChatSettingsAI />
            </Topic>
            <Topic icon={<ScienceIcon />} title='Labs' startCollapsed>
              <UxLabsSettings />
            </Topic>
          </Topics>
        </TabPanel>

        <TabPanel value='voice' variant='outlined' sx={_styles.tabPanel}>
          <Topics>
            <Topic icon={/*'🎙️'*/ <MicIcon />} title='Microphone'>
              <VoiceSettings />
            </Topic>
            <Topic icon={/*'📢'*/ <RecordVoiceOverIcon />} title='ElevenLabs API'>
              <ElevenlabsSettings />
            </Topic>
          </Topics>
        </TabPanel>

        <TabPanel value='draw' variant='outlined' sx={_styles.tabPanel}>
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

        <TabPanel value='tools' variant='outlined' sx={_styles.tabPanel}>
          <Topics>
            <Topic icon={<LanguageRoundedIcon />} title='Web Browser'>
              <BrowseSettings />
            </Topic>
            <Topic icon={<SearchIcon />} title='Web Search - Google API' startCollapsed>
              <GoogleSearchSettings />
            </Topic>
            {/*<Topic icon='🛠' title='Other tools...' />*/}
          </Topics>
        </TabPanel>
      </Tabs>

      {/*<Divider />*/}

    </GoodModal>
  );
}
