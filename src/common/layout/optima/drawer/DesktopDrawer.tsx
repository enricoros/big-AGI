import * as React from 'react';

import { Box, Sheet, styled } from '@mui/joy';

import { checkVisibleNav, NavItemApp } from '~/common/app.nav';
import { themeZIndexDesktopDrawer } from '~/common/app.theme';

import { optimaCloseDrawer, optimaOpenDrawer, useOptimaDrawerOpen } from '../useOptima';
import { useOptimaPortalOutRef } from '../portals/useOptimaPortalOutRef';


// set to 0 to always keep the drawer mounted (smoother on/off)
const UNMOUNT_DELAY_MS = 0;


// Desktop Drawer

const DesktopDrawerFixRoot = styled(Box)({
  // fix the drawer size
  width: 'var(--AGI-Desktop-Drawer-width)',
  flexShrink: 0,
  flexGrow: 0,
});

const DesktopDrawerTranslatingSheet = styled(Sheet)(({ theme }) => ({
  // layouting
  width: '100%',
  height: '100dvh',

  // sliding
  transition: 'transform 0.42s cubic-bezier(.17,.84,.44,1)',
  zIndex: themeZIndexDesktopDrawer,

  // styling
  backgroundColor: 'transparent',
  borderRight: '1px solid',
  // the border right color is from: theme.palette.divider, which is this /0.2 (light) and /0.16 (dark)
  borderRightColor: 'rgba(var(--joy-palette-neutral-mainChannel, 99 107 116) / 0.4)',
  // borderTopRightRadius: 'var(--AGI-Optima-Radius)',
  // borderBottomRightRadius: 'var(--AGI-Optima-Radius)',
  // contain: 'strict',
  // boxShadow: theme.shadow.md, // too thin and complex; also tried 40px blurs
  boxShadow: `0px 0px 6px 0 rgba(${theme.palette.neutral.darkChannel} / 0.12)`,

  // content layout
  display: 'flex',
  flexDirection: 'column',
})) as typeof Sheet;


export function DesktopDrawer(props: { component: React.ElementType, currentApp?: NavItemApp }) {

  // state
  const drawerPortalRef = useOptimaPortalOutRef('optima-portal-drawer', 'DesktopDrawer');

  // external state
  const isDrawerOpen = useOptimaDrawerOpen();
  // const hasDrawerContent = useOptimaPortalHasInputs('optima-portal-drawer');

  // local state
  const [_softDrawerUnmount, setSoftDrawerUnmount] = React.useState(false);


  // 'soft unmount': remove contents after a delay
  React.useEffect(() => {
    if (!UNMOUNT_DELAY_MS)
      return;

    // drawer open: do not unmount
    if (isDrawerOpen) {
      setSoftDrawerUnmount(false);
      return;
    }

    // drawer closed: delayed unmount
    const unmountTimeoutId = setTimeout(() =>
        setSoftDrawerUnmount(true)
      , UNMOUNT_DELAY_MS);
    return () => clearTimeout(unmountTimeoutId);
  }, [isDrawerOpen]);


  // Desktop-only?: close the drawer if the current app doesn't use it
  const currentAppUsesDrawer = !props.currentApp?.hideDrawer;
  React.useEffect(() => {
    if (!currentAppUsesDrawer)
      optimaCloseDrawer();
  }, [currentAppUsesDrawer]);

  // [special case] remove in the future
  const shallOpenNavForSharedLink = !props.currentApp?.hideDrawer && checkVisibleNav(props.currentApp);
  React.useEffect(() => {
    if (shallOpenNavForSharedLink)
      optimaOpenDrawer();
  }, [shallOpenNavForSharedLink]);


  return (
    <DesktopDrawerFixRoot
      sx={{
        contain: isDrawerOpen ? undefined : 'strict',
        pointerEvents: isDrawerOpen ? undefined : 'none',
      }}
    >

      <DesktopDrawerTranslatingSheet
        ref={drawerPortalRef}
        component={props.component}
        sx={{
          transform: isDrawerOpen ? 'none' : 'translateX(-100%)',
          // backgroundColor: hasDrawerContent ? undefined : 'background.surface',
        }}
      >

        {/* NOTE: this sort of algo was not used when we migrated this to Portals on 2024-07-30, so not restoring it ... */}
        {/*/!* [UX Responsiveness] Keep Mounted for now *!/*/}
        {/*{(!softDrawerUnmount || isDrawerOpen || !UNMOUNT_DELAY_MS) &&*/}
        {/*  appDrawerContent*/}
        {/*}*/}

      </DesktopDrawerTranslatingSheet>

    </DesktopDrawerFixRoot>
  );
}