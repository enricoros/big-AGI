import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Card, Skeleton } from '@mui/joy';

import { ImageBlock } from '../chat/components/message/blocks/blocks';
import { getActiveTextToImageProviderOrThrow, t2iGenerateImageOrThrow } from '~/modules/t2i/t2i.client';
import { heuristicMarkdownImageReferenceBlocks, RenderImage } from '../chat/components/message/blocks/RenderImage';

import type { TextToImageProvider } from '~/common/components/useCapabilities';
import { InlineError } from '~/common/components/InlineError';
import { themeBgAppChatComposer } from '~/common/app.theme';

import { DesignerPrompt, PromptDesigner } from './components/PromptDesigner';
import { ProviderConfigure } from './components/ProviderConfigure';


const STILL_LAYOUTING = false;


/**
 * @returns up-to `vectorSize` image URLs
 */
async function queryActiveGenerateImageVector(singlePrompt: string, vectorSize: number = 1) {
  const t2iProvider = getActiveTextToImageProviderOrThrow();

  const mdStringsVector = await t2iGenerateImageOrThrow(t2iProvider, singlePrompt, vectorSize);
  if (!mdStringsVector?.length)
    throw new Error('No image generated');

  const block = heuristicMarkdownImageReferenceBlocks(mdStringsVector.join('\n'));
  if (!block?.length)
    throw new Error('No URLs in the generated images');

  return block;
}


function TempPromptImageGen(props: { prompt: DesignerPrompt, sx?: SxProps }) {

  // NOTE: we shall consider a multidimensional shape-based design

  // derived state
  const { prompt: dp } = props;

  // external state
  const { data: imageBlocks, error, isLoading } = useQuery<ImageBlock[], Error>({
    enabled: !!dp.prompt,
    queryKey: ['draw-uuid', dp.uuid],
    queryFn: () => queryActiveGenerateImageVector(dp.prompt, dp._repeatCount),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity,
  });
console.log('imageBlocks', dp);
  return (
    <Box sx={{ ...props.sx, whiteSpace: 'break-spaces' }}>

      {error && <InlineError error={error} />}

      {Array.from({ length: dp._repeatCount }).map((_, index) => {
        const imgUid = `gen-img-${index}`;
        const imageBlock = imageBlocks?.[index] || null;
        return imageBlock
          ? <RenderImage key={imgUid} imageBlock={imageBlock} noTooltip />
          : <Card key={imgUid}>
            <Skeleton animation='wave' variant='rectangular' sx={{ minWidth: 128, width: '100%', aspectRatio: 1 }} />
          </Card>;
      })}
    </Box>
  );
};


export function TextToImage(props: {
  isMobile: boolean,
  providers: TextToImageProvider[],
  activeProviderId: string | null,
  setActiveProviderId: (providerId: (string | null)) => void
}) {

  // state
  const [prompts, setPrompts] = React.useState<DesignerPrompt[]>([]);


  const handleStopDrawing = React.useCallback(() => {
    setPrompts([]);
  }, []);

  const handlePromptEnqueue = React.useCallback((prompts: DesignerPrompt[]) => {
    setPrompts((prevPrompts) => [...prevPrompts, ...prompts]);
  }, []);


  return <>

    <ProviderConfigure
      providers={props.providers}
      activeProviderId={props.activeProviderId}
      setActiveProviderId={props.setActiveProviderId}
      sx={{
        p: { xs: 1, md: 2 },
      }}
    />


    {/* TMP Body */}
    <Box sx={{
      flexGrow: 1,
      overflowY: 'auto',

      // style
      backgroundColor: 'background.level2',
      border: STILL_LAYOUTING ? '1px solid blue' : undefined,
      p: { xs: 1, md: 2 },
    }}>
      <Box sx={{
        my: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        border: STILL_LAYOUTING ? '1px solid purple' : undefined,
        minHeight: '300px',
        // display: 'grid',
        // gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        // gap: {xs: 1, md: 2},
      }}>
        {prompts.map((prompt, index) => {
          return (
            <TempPromptImageGen
              key={prompt.uuid}
              prompt={prompt}
              sx={{
                border: STILL_LAYOUTING ? '1px solid green' : undefined,
              }}
            />
          );
        })}
      </Box>
    </Box>

    <PromptDesigner
      isMobile={props.isMobile}
      queueLength={prompts.length}
      onDrawingStop={handleStopDrawing}
      onPromptEnqueue={handlePromptEnqueue}
      sx={{
        backgroundColor: themeBgAppChatComposer,
        borderTop: `1px solid`,
        borderTopColor: 'divider',
        p: { xs: 1, md: 2 },
      }}
    />

  </>;
}