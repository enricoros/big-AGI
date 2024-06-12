import * as React from 'react';

import { useCapabilityTextToImage } from '~/modules/t2i/t2i.client';

import { DrawHeading } from './create/DrawHeading';
import { DrawUnconfigured } from './create/DrawUnconfigured';
import { TextToImage } from './create/TextToImage';


export function DrawCreate(props: {
  isMobile: boolean
}) {

  // stateo
  const [showHeading, setShowHeading] = React.useState<boolean>(true);

  // external state
  const { activeProviderId, mayWork, providers, setActiveProviderId } = useCapabilityTextToImage();

  return <>

    {/* The container is a 100dvh, flex column with App bg (see `pageCoreSx`) */}
    {showHeading && <DrawHeading
      onRemoveHeading={() => setShowHeading(false)}
      sx={{
        px: { xs: 1, md: 2 },
        py: { xs: 1, md: 6 },
      }}
    />}

    {mayWork ? (
      <TextToImage
        isMobile={props.isMobile}
        providers={providers}
        activeProviderId={activeProviderId}
        setActiveProviderId={setActiveProviderId}
      />
    ) : (
      <DrawUnconfigured />
    )}

  </>;
}
