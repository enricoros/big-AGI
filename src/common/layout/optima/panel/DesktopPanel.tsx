import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Sheet, styled } from '@mui/joy';

import { NavItemApp } from '~/common/app.nav';
import { themeZIndexDesktopPanel } from '~/common/app.theme';

import { optimaClosePanel, useOptimaPanelOpen } from '../useOptima';
import { useOptimaPortalOutRef } from '../portals/useOptimaPortalOutRef';


// set to 0 to always keep the panel mounted (smoother on/off)
const UNMOUNT_DELAY_MS = 0;


// Desktop Panel

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
  // borderTopLeftRadius: 'var(--AGI-Optima-Radius)',
  // borderBottomLeftRadius: 'var(--AGI-Optima-Radius)',
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


export function DesktopPanel(props: { component: React.ElementType, currentApp?: NavItemApp }) {

  // state
  const panelPortalRef = useOptimaPortalOutRef('optima-portal-panel', 'DesktopPanel');

  // external state
  const isPanelOpen = useOptimaPanelOpen();

  // const hasPanelContent = useOptimaPortalHasInputs('optima-portal-panel');

  // local state
  const [_softPanelUnmount, setSoftPanelUnmount] = React.useState(false);

  // 'soft unmount': remove contents after a delay
  // React.useEffect(() => {
  //   if (!UNMOUNT_DELAY_MS)
  //     return;
  //
  //   // panel open: do not unmount
  //   if (isPanelOpen) {
  //     setSoftPanelUnmount(false);
  //     return;
  //   }
  //
  //   // panel closed: delayed unmount
  //   const unmountTimeoutId = setTimeout(() =>
  //       setSoftPanelUnmount(true)
  //     , UNMOUNT_DELAY_MS);
  //   return () => clearTimeout(unmountTimeoutId);
  // }, [isPanelOpen]);

  // Desktop-only?: close the drawer if the current app doesn't use it
  const appPanelAsMenu = !!props.currentApp?.panelAsMenu;
  React.useEffect(() => {
    if (appPanelAsMenu)
      optimaClosePanel();
  }, [appPanelAsMenu]);

  return (
    <DesktopPanelFixRoot
      sx={isPanelOpen ? undefined : panelFixRootSx}
    >

      <DesktopPanelTranslatingSheet
        ref={panelPortalRef}
        component={props.component}
        sx={{
          transform: isPanelOpen ? 'none' : 'translateX(100%)',
          // backgroundColor: hasDrawerContent ? undefined : 'background.surface',
        }}
      >

        {/* NOTE: this sort of algo was not used when we migrated this to Portals on 2024-07-30, so not restoring it ... */}
        {/*/!* [UX Responsiveness] Keep Mounted for now *!/*/}
        {/*{(!softDrawerUnmount || isDrawerOpen || !UNMOUNT_DELAY_MS) &&*/}
        {/*  appDrawerContent*/}
        {/*}*/}

      </DesktopPanelTranslatingSheet>

    </DesktopPanelFixRoot>
  );
}