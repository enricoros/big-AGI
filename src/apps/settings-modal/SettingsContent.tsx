import * as React from 'react';

import { Box, Button, List, ListDivider, ListItem, ListItemButton, ListItemContent, ListItemDecorator, Typography } from '@mui/joy';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import SearchIcon from '@mui/icons-material/Search';
import TerminalOutlinedIcon from '@mui/icons-material/TerminalOutlined';

import { optimaActions } from '~/common/layout/optima/useOptima';

import { ASRxConfigureEngines } from '~/modules/asrx/components/ASRxConfigureEngines';
import { BrowseSettings } from '~/modules/browse/BrowseSettings';
import { DallESettings } from '~/modules/t2i/dalle/DallESettings';
import { GoogleSearchSettings } from '~/modules/google/GoogleSearchSettings';
import { T2ISettings } from '~/modules/t2i/T2ISettings';

import type { SettingsNavId } from './settings.nav';
import { AppChatSettingsAI } from './AppChatSettingsAI';
import { AppChatSettingsUI } from './settings-ui/AppChatSettingsUI';
import { UxLabsSettings } from './UxLabsSettings';
import { VoiceInSettings } from './VoiceInSettings';
import { VoiceOutSettings } from './VoiceOutSettings';
import { getSettingsNavChildren } from './settings.nav';


const _styles = {

  // a single constrained reading column keeps label/control pairs together (not stretched across the pane)
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    maxWidth: 560,
  } as const,

  // wraps each content group; gap matches the previous AccordionDetails grid
  block: {
    display: 'grid',
    gap: 2,
  } as const,

  intro: {
    color: 'text.secondary',
  } as const,

  // section header reuses the app's own ListDivider idiom (consistent with the in-content dividers)
  sectionDivider: {
    my: 0,
  } as const,

  // parent 'hub' page: a stack of cards that navigate into the child sub-sections
  childNavList: {
    gap: 1,
    p: 0,
    '--ListItem-radius': 'var(--joy-radius-md)',
    '--ListItemDecorator-size': '2.25rem',
  } as const,

  childNavButton: {
    py: 1.25,
    gap: 1,
    alignItems: 'center',
    '--Icon-color': 'var(--joy-palette-text-secondary)',
  } as const,

  searchBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  } as const,

  searchBannerButton: {
    // copied from ButtonSearchControl._styles.desktop
    minWidth: 100,
    justifyContent: 'flex-start',
    borderRadius: '18px',
    pointerEvents: 'none',
    '[data-joy-color-scheme="light"] &': { bgcolor: '#d5ec31' },
    boxShadow: 'inset 0 2px 4px -1px rgba(0,0,0,0.15)',
    textWrap: 'nowrap',
  } as const,

} as const;


function SectionHeader(props: { label: string }) {
  return <ListDivider inset='gutter' sx={_styles.sectionDivider}>{props.label}</ListDivider>;
}

/** Parent 'hub' navigation: one card per child sub-section, so the parent page stays small. */
function ChildNav(props: { parentId: SettingsNavId, onSelect: (id: SettingsNavId) => void }) {
  return (
    <List sx={_styles.childNavList}>
      {getSettingsNavChildren(props.parentId).map((child) => (
        <ListItem key={child.id}>
          <ListItemButton variant='outlined' onClick={() => props.onSelect(child.id)} sx={_styles.childNavButton}>
            <ListItemDecorator>{child.icon}</ListItemDecorator>
            <ListItemContent>
              <Typography level='title-sm'>{child.label}</Typography>
              {!!child.description && <Typography level='body-xs' sx={{ color: 'text.secondary' }}>{child.description}</Typography>}
            </ListItemContent>
            <KeyboardArrowRightIcon />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}


function VoiceInputBlock(props: { isMobile: boolean }) {
  return (
    <Box sx={_styles.block}>
      <VoiceInSettings isMobile={props.isMobile} />
      <ASRxConfigureEngines isMobile={props.isMobile} />
    </Box>
  );
}

function VoiceOutputBlock(props: { isMobile: boolean }) {
  return (
    <Box sx={_styles.block}>
      <VoiceOutSettings isMobile={props.isMobile} />
    </Box>
  );
}

/** Diagnostics group: developer/inspection surfaces (not AI tools), styled as the child-nav cards. */
function ToolsDiagnostics() {
  return <>
    <SectionHeader label='Diagnostics' />
    <List size='sm' sx={_styles.childNavList}>
      <ListItem>
        <ListItemButton onClick={() => optimaActions().openAIXDebugger()} sx={_styles.childNavButton}>
          <ListItemDecorator><TerminalOutlinedIcon /></ListItemDecorator>
          <ListItemContent>
            AI Inspector
            <Typography level='body-xs' >Inspect live AI requests</Typography>
          </ListItemContent>
          <NorthEastIcon sx={{ fontSize: 'lg' }} />
        </ListItemButton>
      </ListItem>
      <ListItem>
        <ListItemButton onClick={() => optimaActions().openLogger()} sx={_styles.childNavButton}>
          <ListItemDecorator><TerminalOutlinedIcon /></ListItemDecorator>
          <ListItemContent>
            Logs Viewer
            <Typography level='body-xs' sx={{ color: 'text.secondary' }}>View application logs</Typography>
          </ListItemContent>
          <NorthEastIcon sx={{ fontSize: 'lg' }} />
        </ListItemButton>
      </ListItem>
    </List>
  </>;
}

function ToolsSearchBanner() {
  return (
    <Box sx={_styles.searchBanner}>
      <Button variant='soft' color='success' startDecorator={<SearchIcon />} sx={_styles.searchBannerButton}>
        Search
      </Button>
      <Box sx={{ flex: 1 }}>
        <Typography level='body-sm' sx={{ fontWeight: 'md', mb: 0.5 }}>
          Use the Search button
        </Typography>
        <Typography level='body-xs' sx={{ color: 'text.secondary' }}>
          Modern AI models have native search built-in. Click the Search button when chatting to enable real-time web search.
        </Typography>
      </Box>
    </Box>
  );
}


function renderSection(nodeId: SettingsNavId, isMobile: boolean, onSelect: (id: SettingsNavId) => void): React.ReactNode {
  switch (nodeId) {

    case 'appearance':
      return <Box sx={_styles.block}><AppChatSettingsUI /></Box>;

    case 'ai':
      return <Box sx={_styles.block}><AppChatSettingsAI /></Box>;

    // Voice parent (hub): no common settings - just links into Input / Output
    case 'voice':
      return <>
        <Typography level='body-sm' sx={_styles.intro}>
          Configure speech input and output.
        </Typography>
        <ChildNav parentId='voice' onSelect={onSelect} />
      </>;
    case 'voice-in':
      return <VoiceInputBlock isMobile={isMobile} />;
    case 'voice-out':
      return <VoiceOutputBlock isMobile={isMobile} />;

    // Draw: flat, provider picker then provider-specific (OpenAI) settings
    case 'draw':
      return <>
        <Box sx={_styles.block}><T2ISettings /></Box>
        <SectionHeader label='OpenAI' />
        <Box sx={_styles.block}><DallESettings /></Box>
      </>;

    // Tools parent (hub): common search info, then links into Browsing / Custom Search
    case 'tools':
      return <>
        <ToolsSearchBanner />
        <ChildNav parentId='tools' onSelect={onSelect} />
        <ToolsDiagnostics />
      </>;
    case 'tools-browse':
      return <Box sx={_styles.block}><BrowseSettings /></Box>;
    case 'tools-search':
      return <Box sx={_styles.block}><GoogleSearchSettings /></Box>;

    case 'labs':
      return <Box sx={_styles.block}><UxLabsSettings /></Box>;

    default:
      const _exhaustiveCheck: never = nodeId;
      return null;
  }
}


/**
 * The detail pane: renders a single nav section. Leaf nodes render their content directly;
 * parent nodes (with children) render a light 'hub' - any common content plus cards that
 * navigate into the sub-sections, so the parent page never stacks all children at once.
 */
export function SettingsContent(props: { nodeId: SettingsNavId, isMobile?: boolean, onSelect: (id: SettingsNavId) => void }) {
  return (
    <Box sx={_styles.container}>
      {renderSection(props.nodeId, props.isMobile === true, props.onSelect)}
    </Box>
  );
}
