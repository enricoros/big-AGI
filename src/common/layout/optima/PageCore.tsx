import * as React from 'react';

import { Box } from '@mui/joy';

import { themeBgApp, themeZIndexPageBar } from '~/common/app.theme';
import type { NavItemApp } from '~/common/app.nav';

import { PageBar } from './PageBar';


export const PageCore = (props: {
  component: React.ElementType,
  currentApp?: NavItemApp,
  isMobile?: boolean,
  children: React.ReactNode,
}) =>
  <Box
    component={props.component}
    sx={{
      // background: 'url(/images/big-agi-background-3.png) no-repeat center bottom fixed',
      backgroundColor: themeBgApp,
      height: '100dvh',
      display: 'flex', flexDirection: 'column',
    }}
  >

    {/* Responsive page bar (pluggable App Center Items and App Menu) */}
    <PageBar
      currentApp={props.currentApp}
      isMobile={props.isMobile}
      sx={{
        zIndex: themeZIndexPageBar,
      }}
    />

    {/* Page (NextJS) must make the assumption they're in a flex-col layout */}
    {props.children}

    {/* [Mobile] Nav bar at the bottom */}
    {/* FIXME: TEMP: Disable mobilenav */}
    {/*{props.isMobile && <MobileNav hideOnFocusMode currentApp={props.currentApp} />}*/}

  </Box>;