import * as React from 'react';

import { useCapabilityTextToImage } from '~/modules/t2i/t2i.client';

import { OptimaToolbarIn } from '~/common/layout/optima/portals/OptimaPortalsIn';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useProcessingQueue } from '~/common/logic/ProcessingQueue';

import { DrawCreate } from './DrawCreate';
import { DrawGallery } from './DrawGallery';
import { drawCreateQueue } from './queue-draw-create';
import { useDrawSectionDropdown } from './useDrawSectionDropdown';


// export interface AppDrawIntent {
//   backTo: 'app-chat';
// }


export function AppDraw() {

  // state
  const [showHeader, setShowHeader] = React.useState(true);
  // const [_drawIntent, setDrawIntent] = React.useState<AppDrawIntent | null>(null);

  // external state
  const isMobile = useIsMobile();
  const { queueState, queueAddItem, queueCancelAll } = useProcessingQueue(drawCreateQueue);
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
  const { drawSection, drawSectionDropdown } = useDrawSectionDropdown(queueState.items.length, queueCancelAll);

  return <>
    <OptimaToolbarIn>{drawSectionDropdown}</OptimaToolbarIn>

    {drawSection === 'create' ? (
      <DrawCreate
        queue={drawCreateQueue}
        isMobile={isMobile}
        showHeader={showHeader}
        onHideHeader={() => setShowHeader(false)}
        mayWork={mayWork}
        providers={providers}
        activeProviderId={activeProviderId}
        setActiveProviderId={setActiveProviderId}
      />
    ) : drawSection === 'browse' ? (
      <DrawGallery domain='draw' />
    ) : drawSection === 'media' ? (
      <DrawGallery domain='app' />
    ) : null}

  </>;
}