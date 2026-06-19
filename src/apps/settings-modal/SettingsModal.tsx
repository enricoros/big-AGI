import * as React from 'react';

import { Box, Button } from '@mui/joy';
import KeyboardCommandKeyOutlinedIcon from '@mui/icons-material/KeyboardCommandKeyOutlined';
import TerminalOutlinedIcon from '@mui/icons-material/TerminalOutlined';

import type { PreferencesTabId } from '~/common/layout/optima/store-layout-optima';
import { AppBreadcrumbs } from '~/common/components/AppBreadcrumbs';
import { DarkModeToggleButton, darkModeToggleButtonSx } from '~/common/components/DarkModeToggleButton';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { optimaActions } from '~/common/layout/optima/useOptima';
import { useIsMobile } from '~/common/components/useMatchMedia';

import { SettingsContent } from './SettingsContent';
import { SettingsNavList } from './SettingsNavList';
import { SettingsNavSelect } from './SettingsNavSelect';
import { getSettingsNavTopLevelGroup, resolveSettingsNavId } from './settings.nav';


const _styles = {

  // mobile: fullscreen, content flows and scrolls naturally
  modalMobile: {
    flexGrow: 1,
    backgroundColor: 'background.level1',
  },

  // desktop: tuned width (keeps form rows paired, not stretched) + height-bounded so the right pane scrolls internally
  modalDesktop: {
    backgroundColor: 'background.level1',
    width: 'min(780px, 94vw)',
    maxWidth: 'min(780px, 94vw)',
    // minHeight: '620px', // 540px
    // maxHeight: 'min(86svh, 720px)',
  },

  // desktop two-pane body: CSS grid with a fixed sidebar track + fluid content track.
  // grid (not flex) so the sidebar width is honored regardless of Joy List's intrinsic flex-grow;
  // minmax(0, 1fr) lets the content track shrink and scroll instead of overflowing horizontally.
  // full-bleed so the sidebar/divider reach the dialog edges.
  body: {
    // backgroundColor: 'background.popup',
    flex: 1,
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: '192px minmax(0, 1fr)',
    gridTemplateRows: 'minmax(0, 1fr)',
    mx: 'calc(-1 * var(--Card-padding))',
  },

  content: {
    backgroundColor: 'background.surface',
    borderRadius: 'lg',
    // borderTopRightRadius: 0,
    // borderBottomRightRadius: 0,
    boxShadow: 'md',
    minWidth: 0,
    minHeight: 482,
    overflowY: 'auto',
    px: 3,
    py: 1.5,
    zIndex: 1,
  },

  mobileBody: {
    display: 'flex',
    flexDirection: 'column',
  },

  mobileContent: {
    backgroundColor: 'background.surface',
    mx: 'calc(-1 * var(--Card-padding))',
    p: 'var(--Card-padding)',
    // borderRadius: 'md',
    boxShadow: 'xs',
  },

  startButton: {
    display: 'flex',
    gap: 1,
    alignItems: 'center',
  },

} as const;


/**
 * Component that allows the User to modify the application settings,
 * persisted on the client via localStorage.
 *
 * Layout: a master-detail navigation. Desktop shows an always-expanded tree on the left and a
 * scrollable detail pane on the right; mobile shows a top section selector with content below.
 * The external `tab` (PreferencesTabId, incl. legacy aliases) is resolved to a nav node here, so
 * callers keep using `optimaOpenPreferences('voice'|'draw'|...)` unchanged.
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

  // derived nav state
  const { setTab } = props;
  const nodeId = resolveSettingsNavId(props.tab);
  const isToolsSection = getSettingsNavTopLevelGroup(nodeId) === 'tools';
  const enableAixDebuggerDialog = true;

  return (
    <GoodModal
      // title='Preferences' strongerTitle
      title={
        <AppBreadcrumbs size='md' rootTitle={isMobile ? 'App' : 'Application'}>
          <AppBreadcrumbs.Leaf><b>Preferences</b></AppBreadcrumbs.Leaf>
        </AppBreadcrumbs>
      }
      open={props.open} onClose={props.onClose}
      fullscreen={isMobile}
      startButton={
        <Box sx={_styles.startButton}>
          {!isToolsSection && <DarkModeToggleButton hasText />}
          {!isMobile && !isToolsSection && <Button variant='soft' color='neutral' onClick={props.onOpenShortcuts} startDecorator={<KeyboardCommandKeyOutlinedIcon color='primary' />} sx={darkModeToggleButtonSx}>
            Shortcuts
          </Button>}
          {isToolsSection && <Button variant='soft' color='neutral' disabled={!enableAixDebuggerDialog} onClick={optimaActions().openAIXDebugger} startDecorator={<TerminalOutlinedIcon color={enableAixDebuggerDialog ? 'primary' : undefined} />} sx={darkModeToggleButtonSx}>
            AI Inspector
          </Button>}
          {isToolsSection && <Button variant='soft' color='neutral' onClick={optimaActions().openLogger} startDecorator={<TerminalOutlinedIcon color='primary' />} sx={darkModeToggleButtonSx}>
            Logs Viewer
          </Button>}
        </Box>
      }
      unfilterBackdrop
      darkerBackdrop
      sx={isMobile ? _styles.modalMobile : _styles.modalDesktop}
    >

      {isMobile ? (
        <Box sx={_styles.mobileBody}>
          <SettingsNavSelect value={nodeId} onSelect={setTab} />
          <Box sx={_styles.mobileContent}>
            <SettingsContent nodeId={nodeId} isMobile onSelect={setTab} />
          </Box>
        </Box>
      ) : (
        <Box sx={_styles.body}>
          <SettingsNavList value={nodeId} onSelect={setTab} />
          <Box sx={_styles.content}>
            <SettingsContent nodeId={nodeId} onSelect={setTab} />
          </Box>
        </Box>
      )}

    </GoodModal>
  );
}
