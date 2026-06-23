import * as React from 'react';

import { Box, Button } from '@mui/joy';
import KeyboardCommandKeyOutlinedIcon from '@mui/icons-material/KeyboardCommandKeyOutlined';

import type { PreferencesTabId } from '~/common/layout/optima/store-layout-optima';
import { AppBreadcrumbs } from '~/common/components/AppBreadcrumbs';
import { DarkModeToggleButton, darkModeToggleButtonSx } from '~/common/components/DarkModeToggleButton';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { useIsMobile } from '~/common/components/useMatchMedia';

import { SettingsContent } from './SettingsContent';
import { SettingsNavList } from './SettingsNavList';
import { SettingsNavSelect } from './SettingsNavSelect';
import { resolveSettingsNavId } from './settings.nav';


const _styles = {

  // mobile: fullscreen, content flows and scrolls naturally
  modalMobile: {
    flexGrow: 1,
    backgroundColor: 'background.level1',
  },

  // desktop: tuned width (keeps form rows paired, not stretched) + height-bounded so the right pane scrolls internally
  modalDesktop: {
    boxShadow: 'none',
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
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    boxShadow: 'md',
    // boxShadow: 'inset 1px 1px 4px -2px rgba(0, 0, 0, 0.2)', // sync with PersonaDescriptionCard.tsx
    // outline: '1px solid',
    // outlineColor: 'divider',
    minWidth: 0,
    minHeight: 'max(490px, 45svh)',
    overflowY: 'auto',
    px: 'var(--Card-padding)', // was px: 3, py: 1.5
    py: 2,
    // mr: 'var(--Card-padding)',
    // mb: 0.5,
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
          <DarkModeToggleButton hasText />
          {!isMobile && <Button variant='soft' color='neutral' onClick={props.onOpenShortcuts} startDecorator={<KeyboardCommandKeyOutlinedIcon color='primary' />} sx={darkModeToggleButtonSx}>
            Shortcuts
          </Button>}
        </Box>
      }
      unfilterBackdrop
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
