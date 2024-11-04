import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { themeBgApp, themeZIndexPageBar } from '~/common/app.theme';
import type { NavItemApp } from '~/common/app.nav';

// import { MobileNav } from './MobileNav';
import { OptimaBar } from '~/common/layout/optima/bar/OptimaBar';


const pageCoreSx: SxProps = {
  // background: 'url(/images/big-agi-background-3.png) no-repeat center bottom fixed',
  backgroundColor: themeBgApp,
  height: '100dvh',
  display: 'flex', flexDirection: 'column',
};

const pageCoreBarSx: SxProps = {
  zIndex: themeZIndexPageBar,
};

const pageCoreMobileNavSx: SxProps = {
  flex: 0,
};


export const PageCore = (props: {
  component: React.ElementType,
  currentApp?: NavItemApp,
  isMobile: boolean,
  children: React.ReactNode,
}) =>
  <Box
    component={props.component}
    sx={pageCoreSx}
  >

    {/* Responsive page bar (pluggable App Center Items and App Menu) */}
    <OptimaBar
      component='header'
      currentApp={props.currentApp}
      isMobile={props.isMobile}
      sx={pageCoreBarSx}
    />

    {/* Page (NextJS) must make the assumption they're in a flex-col layout */}
    {props.children}

    {/* [Mobile] Nav bar at the bottom */}
    {/*{!!props.isMobile && (*/}
    {/*  <MobileNav*/}
    {/*    component='nav'*/}
    {/*    currentApp={props.currentApp}*/}
    {/*    hideOnFocusMode*/}
    {/*    sx={pageCoreMobileNavSx}*/}
    {/*  />*/}
    {/*)}*/}

  </Box>;