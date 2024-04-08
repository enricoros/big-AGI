import * as React from 'react';

import { useCapabilityTextToImage } from '~/modules/t2i/t2i.client';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useRouterQuery } from '~/common/app.routes';

import { DrawHeading } from './components/DrawHeading';
import { DrawUnconfigured } from './components/DrawUnconfigured';
import { TextToImage } from './TextToImage';


export interface AppDrawIntent {
  backTo: 'app-chat';
}


export function AppDraw() {

  // state
  const [showHeading, setShowHeading] = React.useState<boolean>(true);
  const [_drawIntent, setDrawIntent] = React.useState<AppDrawIntent | null>(null);
  const [section, setSection] = React.useState<number>(0);


  // external state
  const isMobile = useIsMobile();
  const query = useRouterQuery<Partial<AppDrawIntent>>();
  const { activeProviderId, mayWork, providers, setActiveProviderId } = useCapabilityTextToImage();


  // [effect] set intent from the query parameters
  React.useEffect(() => {
    if (query.backTo) {
      setDrawIntent({
        backTo: query.backTo || 'app-chat',
      });
    }
  }, [query]);

  // const hasIntent = !!drawIntent && !!drawIntent.backTo;

  // usePluggableOptimaLayout(null, null, null, 'aa');

  return <>

    {/* The container is a 100dvh, flex column with App bg (see `pageCoreSx`) */}

    {showHeading && <DrawHeading
      section={section}
      setSection={setSection}
      showSections
      onRemoveHeading={() => setShowHeading(false)}
      sx={{
        px: { xs: 1, md: 2 },
        py: { xs: 1, md: 6 },
      }}
    />}

    {!mayWork && <DrawUnconfigured />}

    {/*{mayWork && <Gallery />}*/}

    {mayWork && (
      <TextToImage
        isMobile={isMobile}
        providers={providers}
        activeProviderId={activeProviderId}
        setActiveProviderId={setActiveProviderId}
      />
    )}

  </>;
}