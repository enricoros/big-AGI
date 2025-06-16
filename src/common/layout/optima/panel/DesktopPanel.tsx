import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, List, Sheet, styled } from '@mui/joy';

import { NavItemApp } from '~/common/app.nav';
import { adjustContentScaling, themeScalingMap, themeZIndexDesktopPanel, } from '~/common/app.theme';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUIContentScaling } from '~/common/stores/store-ui';

import { PanelContentPortal } from './PanelContentPortal';
import { optimaClosePanel, useOptimaPanelOpen } from '../useOptima';


// Desktop side Panel with the Portal content

const DesktopPanelFixRoot = styled(Box)({
  // fix the panel size
  width: 'var(--AGI-Desktop-Panel-width)',
  flexShrink: 0,
  flexGrow: 0,
  
  // Base state
  zIndex: themeZIndexDesktopPanel,

  '&[data-closed="true"]': {
    contain: 'strict',
    pointerEvents: 'none',
  },
  
  '&.panel-peeking': {
    zIndex: themeZIndexDesktopPanel + 1, // elevate z-index when peeking
  },
});

const DesktopPanelTranslatingSheet = styled(Sheet)(({ theme }) => ({
  // layout
  width: '100%',
  height: '100dvh',
  zIndex: 1, // just to allocate a layer; this was: themeZIndexDesktopPanel

  // styling
  backgroundColor: 'var(--joy-palette-background-surface)',
  borderLeft: '1px solid',
  // the border left color is from: theme.palette.divider, which is this /0.2 (light) and /0.16 (dark)
  borderLeftColor: 'rgba(var(--joy-palette-neutral-mainChannel, 99 107 116) / 0.4)',
  // borderTopLeftRadius: OPTIMA_DRAWER_MOBILE_RADIUS,
  // borderBottomLeftRadius: OPTIMA_DRAWER_MOBILE_RADIUS,
  // contain: 'strict',
  // boxShadow: theme.shadow.md, // too thin and complex; also tried 40px blurs
  boxShadow: `0px 0px 6px 0 rgba(${theme.palette.neutral.darkChannel} / 0.12)`,

  // content layout
  display: 'flex',
  flexDirection: 'column',

  overflowY: 'auto', // NOTE: this was not present on DesktopDrawer -- we added it here

  // base state (normal open/close, and peeking exit)
  transform: 'none',
  transition: 'transform 0.42s cubic-bezier(.17,.84,.44,1), box-shadow 0.42s cubic-bezier(.17,.84,.44,1)',
  willChange: 'transform, box-shadow',

  // Closed state via data attribute
  '&[data-closed="true"]': {
    transform: 'translateX(101%)', // the extra 1% takes care of fractional units (custom monitor scaling)
    borderLeftColor: 'transparent',
  },

  // Peek state via class
  '&.panel-peeking': {
    transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)', // faster enter animation, shadow as-is
    boxShadow: '0 0 48px rgba(var(--joy-palette-neutral-darkChannel) / 0.4)', // stronger shadow when peeking, was theme.shadow.lg
    borderLeftColor: 'transparent',
  },
})) as typeof Sheet;


export function DesktopPanel(props: { component: React.ElementType, currentApp?: NavItemApp }) {

  // external state
  const isMobile = useIsMobile();
  const contentScaling = adjustContentScaling(useUIContentScaling(), isMobile ? 1 : 0);
  const { panelShownAsPanel, panelShownAsPeeking, panelAsPopup } = useOptimaPanelOpen(false, props.currentApp);
  const isOpen = panelShownAsPanel || panelShownAsPeeking;

  // Close the panel if the current page goes for a popup instead
  React.useEffect(() => {
    if (panelAsPopup)
      optimaClosePanel();
  }, [panelAsPopup]);

  return (
    <DesktopPanelFixRoot
      data-closed={!isOpen}
      className={panelShownAsPeeking ? 'panel-peeking' : undefined}
    >

      <DesktopPanelTranslatingSheet
        component={props.component}
        data-closed={!isOpen}
        className={panelShownAsPeeking ? 'panel-peeking' : undefined}
      >

        <List size={themeScalingMap[contentScaling]?.optimaPanelGroupSize} sx={{ '--ListItem-minHeight': '2.5rem', py: 0 /*0.75*/, flex: 0 }}>
          {/*<OptimaPanelGroupedList>*/}
          {/*<UserAccountListItem />*/}
          {/*<PreferencesListItem />*/}
          {/*</OptimaPanelGroupedList>*/}
        </List>

        {/* [Desktop] Portal in the Panel */}
        {!panelAsPopup && <PanelContentPortal />}

      </DesktopPanelTranslatingSheet>

    </DesktopPanelFixRoot>
  );
}