import * as React from 'react';

import { useIsMobile } from '~/common/components/useMatchMedia';
import { usePluggableOptimaLayout } from '~/common/layout/optima/useOptimaLayout';

import { DrawCreate } from './DrawCreate';
import { DrawGallery } from './DrawGallery';
import { useDrawSectionDropdown } from './useDrawSectionDropdown';
import { useCapabilityTextToImage } from '~/modules/t2i/t2i.client';


// export interface AppDrawIntent {
//   backTo: 'app-chat';
// }


export function AppDraw() {

  // state
  const [showHeader, setShowHeader] = React.useState(true);
  const { drawSection, drawSectionDropdown } = useDrawSectionDropdown();
  // const [_drawIntent, setDrawIntent] = React.useState<AppDrawIntent | null>(null);

  // external state
  const isMobile = useIsMobile();
  const { activeProviderId, mayWork, providers, setActiveProviderId } = useCapabilityTextToImage();

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
      return (
        <DrawCreate
          isMobile={isMobile}
          showHeader={showHeader}
          onHideHeader={() => setShowHeader(false)}
          mayWork={mayWork}
          providers={providers}
          activeProviderId={activeProviderId}
          setActiveProviderId={setActiveProviderId}
        />
      );

    case 'browse':
      return <DrawGallery domain='draw' />;

    case 'media':
      return <DrawGallery domain='app' />;
  }
}