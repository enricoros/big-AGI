import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { themeBgApp, themeZIndexPageBar } from '~/common/app.theme';
import type { NavItemApp } from '~/common/app.nav';

// import { MobileNav } from './MobileNav';
import { OptimaBar } from '~/common/layout/optima/bar/OptimaBar';
import { optimaHasMOTD, OptimaMOTD } from '~/common/layout/optima/OptimaMOTD';


const pageCoreSx: SxProps = {
  // background: 'url(/images/big-agi-background-3.png) no-repeat center bottom fixed',
  backgroundColor: themeBgApp,
  height: '100dvh',
  display: 'flex', flexDirection: 'column',
  transition: 'background-color 0.5s cubic-bezier(.17,.84,.44,1)',
};

const pageCoreFullSx: SxProps = {
  ...pageCoreSx,
  backgroundColor: 'transparent',
} as const;

const pageCoreBrighterSx: SxProps = {
  ...pageCoreSx,
  backgroundColor: 'background.surface',
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
  isFull: boolean,
  isMobile: boolean,
  children: React.ReactNode,
}) =>
  <Box
    component={props.component}
    sx={props.currentApp?.pageBrighter ? pageCoreBrighterSx : props.isFull ? pageCoreFullSx : pageCoreSx}
  >

    {/* Optional deployment MOTD */}
    {optimaHasMOTD && <OptimaMOTD />}

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