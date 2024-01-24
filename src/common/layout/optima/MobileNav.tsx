import * as React from 'react';

import { Typography } from '@mui/joy';

import type { NavItemApp } from '~/common/app.nav';

import { InvertedBar, InvertedBarCornerItem } from './components/InvertedBar';
import { useOptimaLayout } from '~/common/layout/optima/useOptimaLayout';


export function MobileNav(props: { component: React.ElementType, currentApp?: NavItemApp, hideOnFocusMode?: boolean }) {

  // external state
  const { isFocusedMode } = useOptimaLayout();

  // NOTE: this may be abrupt a little
  if (isFocusedMode && props.hideOnFocusMode)
    return null;

  return (
    <InvertedBar
      id='mobile-nav'
      component={props.component}
      direction='horizontal'
      sx={{
        justifyContent: 'space-around',
      }}
    >
      <InvertedBarCornerItem sx={{ width: 'auto' }}>
        <Typography level='title-sm'>
          Chat
        </Typography>
      </InvertedBarCornerItem>

      <Typography>
        FIXME: MobileNav
      </Typography>
    </InvertedBar>
  );
}