import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, List, Sheet, styled } from '@mui/joy';

import { NavItemApp } from '~/common/app.nav';
import { themeScalingMap, themeZIndexDesktopPanel } from '~/common/app.theme';
import { useUIContentScaling } from '~/common/stores/store-ui';

import { PanelContentPortal } from './PanelContentPortal';
import { optimaClosePanel, useOptimaPanelOpen } from '../useOptima';


// Desktop side Panel with the Portal content

const DesktopPanelFixRoot = styled(Box)({
  // fix the panel size
  width: 'var(--AGI-Desktop-Panel-width)',
  flexShrink: 0,
  flexGrow: 0,
});

const DesktopPanelTranslatingSheet = styled(Sheet)(({ theme }) => ({
  // layout
  width: '100%',
  height: '100dvh',

  // sliding
  transition: 'transform 0.42s cubic-bezier(.17,.84,.44,1)',
  zIndex: themeZIndexDesktopPanel,

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
})) as typeof Sheet;

const panelFixRootSx: SxProps = {
  contain: 'strict',
  pointerEvents: 'none',
};

const sheetOpenSx: SxProps = {
  transform: 'none',
  overflowY: 'auto',
};

const sheetClosedSx: SxProps = {
  transform: 'translateX(100%)',
  overflowY: 'auto',
};


export function DesktopPanel(props: { component: React.ElementType, currentApp?: NavItemApp }) {

  // external state
  const contentScaling = useUIContentScaling();
  const { panelShownAsPanel: isOpen, panelAsPopup } = useOptimaPanelOpen(false, props.currentApp);

  // Close the panel if the current page goes for a popup instead
  React.useEffect(() => {
    if (panelAsPopup)
      optimaClosePanel();
  }, [panelAsPopup]);

  return (
    <DesktopPanelFixRoot sx={isOpen ? undefined : panelFixRootSx}>

      <DesktopPanelTranslatingSheet
        component={props.component}
        sx={isOpen ? sheetOpenSx : sheetClosedSx}
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