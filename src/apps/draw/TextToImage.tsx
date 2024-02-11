import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Card, Skeleton } from '@mui/joy';

import { getActiveTextToImageProviderOrThrow, t2iGenerateImageOrThrow } from '~/modules/t2i/t2i.client';
import { heuristicMarkdownImageReferenceBlocks, RenderImage } from '../chat/components/message/blocks/RenderImage';

import type { TextToImageProvider } from '~/common/components/useCapabilities';
import { themeBgAppChatComposer } from '~/common/app.theme';

import { DesignerPrompt, PromptDesigner } from './components/PromptDesigner';
import { ProviderConfigure } from './components/ProviderConfigure';


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
  const _fakeReqCount = 1;

  // derived state
  const { prompt: dp } = props;

  // external state
  const { data: imageBlocks, isError, error, isLoading } = useQuery({
    enabled: !!dp.prompt,
    queryKey: ['image-gen', dp.uuid],
    queryFn: () => queryActiveGenerateImageVector(dp.prompt, _fakeReqCount),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity,
  });

  return (
    <Box sx={props.sx}>

      {Array.from({ length: _fakeReqCount }).map((_, index) => {
        const imgUid = `gen-img-${index}`;
        const imageBlock = imageBlocks?.[index] || null;
        return imageBlock
          ? <RenderImage key={imgUid} imageBlock={imageBlock} />
          : <Card>
            <Skeleton key={imgUid} variant='rectangular' sx={{ width: 200, height: 200 }} />
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


    <Box sx={{
      flexGrow: 1,
      overflowY: 'auto',

      // style
      backgroundColor: 'background.level2',
      border: '1px solid blue',
      p: { xs: 1, md: 2 },
    }}>
      <Box sx={{
        my: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        border: '1px solid purple',
        minHeight: '300px',
      }}>
        {prompts.map((prompt, index) => <TempPromptImageGen key={prompt.uuid} prompt={prompt} sx={{ border: '1px solid green' }} />)}
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