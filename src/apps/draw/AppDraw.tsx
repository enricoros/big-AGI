import * as React from 'react';

import { useIsMobile } from '~/common/components/useMatchMedia';
import { usePluggableOptimaLayout } from '~/common/layout/optima/useOptimaLayout';

import { DrawCreate } from './DrawCreate';
import { DrawGallery } from './DrawGallery';
import { useDrawSectionDropdown } from './useDrawSectionDropdown';


// export interface AppDrawIntent {
//   backTo: 'app-chat';
// }


export function AppDraw() {

  // state
  const { drawSection, drawSectionDropdown } = useDrawSectionDropdown();
  // const [_drawIntent, setDrawIntent] = React.useState<AppDrawIntent | null>(null);

  // external state
  const isMobile = useIsMobile();
  // const query = useRouterQuery<Partial<AppDrawIntent>>();

  // [effect] set intent from the query parameters
  // React.useEffect(() => {
  //   if (query.backTo) {
  //     setDrawIntent({
  //       backTo: query.backTo || 'app-chat',
  //     });
  //   }
  // }, [query]);
  // const hasIntent = !!drawIntent && !!drawIntent.backTo;


  // pluggable layout
  usePluggableOptimaLayout(null, drawSectionDropdown, null, 'aa');

  switch (drawSection) {
    case 'create':
      return <DrawCreate isMobile={isMobile} />;

    case 'browse':
      return <DrawGallery domain='draw' />;

    case 'media':
      return <DrawGallery domain='app' />;
  }
}