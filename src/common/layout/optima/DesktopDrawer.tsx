import * as React from 'react';

import { Box, Sheet, styled } from '@mui/joy';

import type { NavItemApp } from '~/common/app.nav';
import { themeZIndexDesktopDrawer } from '~/common/app.theme';

import { PageDrawer } from './PageDrawer';
import { useOptimaDrawers } from './useOptimaDrawers';
import { useOptimaLayout } from './useOptimaLayout';


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
  // borderTopRightRadius: 'var(--AGI-Optima-Radius)',
  // borderBottomRightRadius: 'var(--AGI-Optima-Radius)',
  // contain: 'strict',
  boxShadow: theme.shadow.md,

  // content layout
  display: 'flex',
  flexDirection: 'column',
}));


export function DesktopDrawer(props: { currentApp?: NavItemApp }) {

  // external state
  const { isDrawerOpen, closeDrawer, openDrawer } = useOptimaDrawers();
  const { appPaneContent } = useOptimaLayout();

  // local state
  const [softDrawerUnmount, setSoftDrawerUnmount] = React.useState(false);


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
  const currentAppUsesDrawer = !!props.currentApp?.drawer;
  React.useEffect(() => {
    if (!currentAppUsesDrawer)
      closeDrawer();
  }, [closeDrawer, currentAppUsesDrawer]);

  // [special case] remove in the future
  const shallOpenNavForSharedLink = !!props.currentApp?.drawer && !!props.currentApp?.hideNav;
  React.useEffect(() => {
    if (shallOpenNavForSharedLink)
      openDrawer();
  }, [openDrawer, shallOpenNavForSharedLink]);


  return (
    <DesktopDrawerFixRoot
      sx={{
        contain: isDrawerOpen ? undefined : 'strict',
      }}
    >

      <DesktopDrawerTranslatingSheet
        sx={{
          transform: isDrawerOpen ? 'none' : 'translateX(-100%)',
        }}
      >

        {/* [UX Responsiveness] Keep Mounted for now */}
        {(!softDrawerUnmount || isDrawerOpen || !UNMOUNT_DELAY_MS) && (
          <PageDrawer currentApp={props.currentApp} onClose={closeDrawer}>
            {appPaneContent}
          </PageDrawer>
        )}

      </DesktopDrawerTranslatingSheet>

    </DesktopDrawerFixRoot>
  );
}