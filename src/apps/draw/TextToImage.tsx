import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Card, Skeleton } from '@mui/joy';

import type { ImageBlock } from '~/modules/blocks/blocks';
import { addDBlobItem } from '~/modules/dblobs/dblobs.db';
import { createDBlobImageItem } from '~/modules/dblobs/dblobs.types';
import { getActiveTextToImageProviderOrThrow, t2iGenerateImagesOrThrow } from '~/modules/t2i/t2i.client';

import type { TextToImageProvider } from '~/common/components/useCapabilities';
import { InlineError } from '~/common/components/InlineError';
import { createDMessageDataRefDBlob } from '~/common/stores/chat/chat.message';
import { themeBgAppChatComposer } from '~/common/app.theme';

import { DesignerPrompt, PromptDesigner } from './components/PromptDesigner';
import { ProviderConfigure } from './components/ProviderConfigure';


const STILL_LAYOUTING = false;


/**
 * @returns up-to `vectorSize` image URLs
 */
async function queryActiveGenerateImageVector(singlePrompt: string, vectorSize: number = 1) {
  const t2iProvider = getActiveTextToImageProviderOrThrow();

  const images = await t2iGenerateImagesOrThrow(t2iProvider, singlePrompt, vectorSize);
  if (!images?.length)
    throw new Error('No image generated');

  // save the generated images
  for (const _i of images) {

    // Create DBlob image item
    const dblobImageItem = createDBlobImageItem(
      singlePrompt,
      {
        mimeType: _i.mimeType as any, /* we assume the mime is supported */
        base64: _i.base64Data,
      },
      {
        origin: 'generated',
        source: 'ai-text-to-image',
        // generatorName: t2iProvider.painter,
        generatorName: _i.generatorName,
        prompt: _i.altText,
        parameters: _i.parameters,
        generatedAt: _i.generatedAt,
      },
      {
        width: _i.width || 0,
        height: _i.height || 0,
        // description: '',
      },
    );

    // Add to DBlobs database
    const dblobId = await addDBlobItem(dblobImageItem, 'global', 'app-draw');

    // Create a data reference for the image from the message
    const imagePartDataRef = createDMessageDataRefDBlob(dblobId, _i.mimeType, _i.base64Data.length);

    // TODO: move to DMessageImagePart?
    console.log('TODO: notImplemented: imagePartDataRef: CRUD and View of blobs as ImageBlocks', imagePartDataRef);
  }

  // const block = heuristicMarkdownImageReferenceBlocks(images.join('\n'));
  // if (!block?.length)
  //   throw new Error('No URLs in the generated images');

  return [];
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

  return <>

    {error && <InlineError error={error} />}

    {Array.from({ length: dp._repeatCount }).map((_, index) => {
      const imgUid = `gen-img-${index}`;
      const imageBlock = imageBlocks?.[index] || null;
      return imageBlock
        // ? <RenderImage key={imgUid} imageBlock={imageBlock} noTooltip />
        ? <Box sx={{


          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative',
          mx: 'auto', my: 'auto', // mt: (index > 0 || !props.isFirst) ? 1.5 : 0,
          boxShadow: 'lg',
          backgroundColor: 'neutral.solidBg',

          '& picture': { display: 'flex' },
          '& img': { maxWidth: '100%', maxHeight: '100%' },

        }}>
          <picture><img src={imageBlock.url} alt={imageBlock.alt} /></picture>
        </Box>
        : <Card key={imgUid} sx={{ mb: 'auto' }}>
          <Skeleton animation='wave' variant='rectangular' sx={{ minWidth: 128, width: '100%', aspectRatio: 1 }} />
        </Card>;
    })}

  </>;
}


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
    setPrompts((prevPrompts) => [...prompts, ...prevPrompts]);
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
        // my: 'auto',
        // display: 'flex', flexDirection: 'column', alignItems: 'center',
        border: STILL_LAYOUTING ? '1px solid purple' : undefined,
        minHeight: '300px',

        // layout
        display: 'grid',
        gridTemplateColumns: props.isMobile
          ? 'repeat(auto-fit, minmax(320px, 1fr))'
          : 'repeat(auto-fit, minmax(max(min(100%, 400px), 100%/5), 1fr))',
        gap: { xs: 2, md: 2 },
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