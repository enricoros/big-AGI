import * as React from 'react';

import { useIsMobile } from '~/common/components/useMatchMedia';

import { AppContainer } from './AppContainer';
import { AppModals } from './AppModals';
import { useNextLoadProgress } from './components/useNextLoadProgress';


/*function ResponsiveNavigation() {
  return <>
    <Drawer
      open={false}
      variant='solid'
      anchor='left'
      onClose={() => {
      }}
      sx={{
        '& .MuiDrawer-paper': {
          width: 256,
          boxSizing: 'border-box',
        },
      }}
    >
      <Box sx={{ width: 256, height: '100%' }}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ flexGrow: 1 }} />
        </Box>
      </Box>
    </Drawer>
  </>;
}*/


/**
 * Core layout of big-AGI, used by all the Primary applications therein.
 *
 * Main functions:
 *  - modern responsive layout
 *  - core layout of the application, with the Nav, Panes, Appbar, etc.
 *    - the child(ren) of this layout are placed in the main content area
 *  - allows for pluggable components of children applications, via usePluggableOptimaLayout
 *  - overlays and displays various modals
 *  - flicker free
 */
export function OptimaLayout(props: { suspendAutoModelsSetup?: boolean, children: React.ReactNode, }) {

  // external state
  const isMobile = useIsMobile();

  // this will display a progress bar while the next NextJS page is loading
  useNextLoadProgress();

  return <>

    {/*<Box sx={{*/}
    {/*  display: 'flex', flexDirection: 'row',*/}
    {/*  maxWidth: '100%', flexWrap: 'nowrap',*/}
    {/*  // overflowX: 'hidden',*/}
    {/*  background: 'lime',*/}
    {/*}}>*/}

    {/*<Box sx={{ background: 'rgba(100 0 0 / 0.5)' }}>a</Box>*/}

  return (
    <OptimaLayoutProvider>

    {/* "children" goes here - note that it will 'plug' other pieces of layour  */}
    <AppContainer isMobile={isMobile}>
      {props.children}
    </AppContainer>

    {/*<Box sx={{ background: 'rgba(100 0 0 / 0.5)' }}>bb</Box>*/}

    {/*</Box>*/}

    </OptimaLayoutProvider>
  );
}