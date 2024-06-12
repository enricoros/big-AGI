import * as React from 'react';

import { useCapabilityTextToImage } from '~/modules/t2i/t2i.client';

import { DrawSectionHeading } from './create/DrawSectionHeading';
import { DrawUnconfigured } from './create/DrawUnconfigured';
import { TextToImage } from './create/TextToImage';


export function DrawCreate(props: {
  isMobile: boolean,
  showHeader: boolean,
  onHideHeader: () => void,
}) {

  // state
  const [working, setWorking] = React.useState(false);

  // external state
  const { activeProviderId, mayWork, providers, setActiveProviderId } = useCapabilityTextToImage();

  return <>

    {/* The container is a 100dvh, flex column with App bg (see `pageCoreSx`) */}
    {props.showHeader && (
      <DrawSectionHeading
        isBeta
        title='Imagine'
        subTitle={mayWork ? 'Model, Prompts, Go!' : 'No AI providers configured :('}
        chipText='Multi-model, AI Text-to-Image'
        highlight={working}
        onRemoveHeading={props.onHideHeader}
        sx={{
          m: { xs: 1, md: 2 },
          boxShadow: 'sm',
        }}
      />
    )}

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
