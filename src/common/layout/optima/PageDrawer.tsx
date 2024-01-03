import * as React from 'react';

import type { NavItemApp } from '~/common/app.nav';

import { PageDrawerHeader } from './components/PageDrawerHeader';


export function PageDrawer(props: {
  currentApp?: NavItemApp,
  onClose: () => void,
  children?: React.ReactNode,
}) {

  // derived state
  const drawerTitle = typeof props.currentApp?.drawer === 'string' ? props.currentApp.drawer : false;

  return <>

    {/* Drawer Header */}
    {drawerTitle && <PageDrawerHeader title={drawerTitle} onClose={props.onClose} />}

    {/* Pluggable Drawer Content */}
    {props.children}

  </>;
}