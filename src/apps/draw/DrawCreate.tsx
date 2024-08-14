import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import type { TextToImageProvider } from '~/common/components/useCapabilities';
import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';
import { ScrollToBottomButton } from '~/common/scroll-to-bottom/ScrollToBottomButton';

import { DesignerPrompt, PromptComposer } from './create/PromptComposer';
import { DrawCreateQueue } from './queue-draw-create';
import { DrawSectionHeading } from './create/DrawSectionHeading';
import { ProviderConfigure } from './create/ProviderConfigure';
import { ZeroDrawConfig } from './create/ZeroDrawConfig';
import { ZeroGenerations } from './create/ZeroGenerations';
import { useProcessingQueue } from '~/common/logic/ProcessingQueue';


const imagineWorkspaceSx: SxProps = {
  flexGrow: 1,
  overflowY: 'auto',

  // style
  backgroundColor: 'background.level3',
  boxShadow: 'inset 0 0 4px 0px rgba(0, 0, 0, 0.2)',

  // layout
  display: 'flex',
  flexDirection: 'column',
};

const imagineScrollContainerSx: SxProps = {
  flex: 1,
  overflowY: 'auto',
  position: 'relative',
  minHeight: 128,
};


/*async function queryActiveGenerateImageVector(singlePrompt: string, vectorSize: number = 1) {
  const imageContentFragments = await t2iGenerateImageContentFragments(null, singlePrompt, vectorSize, 'global', 'app-draw');

  for (const imageContentFragment of imageContentFragments) {
    console.log('TODO: notImplemented: imagePartDataRef: CRUD and View of blobs as ImageBlocks', imageContentFragment.part);
  }
  // TODO continue...

  return [];
}*/

/*
function TempPromptImageGen(props: { prompt: DesignerPrompt, sx?: SxProps }) {

  // NOTE: we shall consider a multidimensional shape-based design

  // derived state
  const { prompt: dp } = props;

  // external state
  const { data: imageBlocks, error, isPending } = useQuery<ImageBlock[], Error>({
    enabled: !!dp.prompt,
    queryKey: ['draw-dpid', dp.uuid],
    queryFn: () => queryActiveGenerateImageVector(dp.prompt, dp._repeatCount),
    refetchOnReconnect: false,
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
*/

export function DrawCreate(props: {
  queue: DrawCreateQueue,
  isMobile: boolean,
  showHeader: boolean,
  onHideHeader: () => void,
  mayWork: boolean,
  providers: TextToImageProvider[],
  activeProviderId: string | null,
  setActiveProviderId: (providerId: (string | null)) => void,
}) {

  // state
  const [prompts, setPrompts] = React.useState<DesignerPrompt[]>([]);


  // external state
  const { queueState } = useProcessingQueue(props.queue);
  console.log('DrawCreate', { queueState });

  // handlers
  const handleStopDrawing = React.useCallback(() => {
    setPrompts([]);
  }, []);

  const { queue } = props;

  const handlePromptEnqueue = React.useCallback((designerPrompts: DesignerPrompt[]) => {
    for (const designerPrompt of designerPrompts) {
      void queue.enqueueItem(designerPrompt); // fire/forget
    }
  }, [queue]);


  return <>

    {/* The container is a '100dvh flex column' with App background (see `pageCoreSx`) */}

    {/* Embossed Imagine Workspace */}
    <Box sx={imagineWorkspaceSx}>

      {/* This box is here to let ScrollToBottomButton anchor to this (relative) insted of the scroll-dependent ScrollToBottom */}
      <Box sx={imagineScrollContainerSx}>

        {/* [overlay] Welcoming header - Closeable */}
        {props.showHeader && (
          <DrawSectionHeading
            isBeta
            title='Imagine'
            subTitle={props.mayWork ? 'Model, Prompts, Go!' : 'No AI providers configured :('}
            chipText='Multi-model, AI Text-to-Image'
            highlight={props.mayWork}
            onRemoveHeading={props.onHideHeader}
            sx={{
              position: 'absolute',
              left: 0, top: 0, right: 0,
              zIndex: 1,
              m: { xs: 1, md: 2 },
              boxShadow: 'md',
            }}
          />
        )}

        <ScrollToBottom
          bootToBottom
          stickToBottomInitial
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            p: { xs: 1, md: 2 },
          }}
        >

          {/* Gallery/Placeholders Grid */}
          <Box sx={{
            // my: 'auto',
            mt: 'auto',
            mx: 'auto',
            border: '1px solid purple',
            minHeight: '300px',

            // layout
            display: 'grid',
            gridTemplateColumns: props.isMobile
              ? 'repeat(auto-fit, minmax(320px, 1fr))'
              : 'repeat(auto-fit, minmax(max(min(100%, 400px), 100%/5), 1fr))',
            gap: { xs: 2, md: 2 },
          }}>

            {/*  {prompts.map((prompt, _index) => {*/}
            {/*    return (*/}
            {/*      <TempPromptImageGen*/}
            {/*        key={prompt.dpId}*/}
            {/*        prompt={prompt}*/}
            {/*        sx={{*/}
            {/*          border: DEBUG_LAYOUT ? '1px solid green' : undefined,*/}
            {/*        }}*/}
            {/*      />*/}
            {/*    );*/}


          </Box>

          <Box sx={{background:'red'}}>THIS APPLICATION IS IN DEV - NOT PROD - DO NOT USE</Box>

          {/* Fallback */}
          <ZeroGenerations />

          {/* End with this Unconfigured message */}
          {!props.mayWork && <ZeroDrawConfig />}


          {/* Visibility and actions are handled via Context */}
          <ScrollToBottomButton />

        </ScrollToBottom>

      </Box>


      {/* Prompt Composer - inside the workspace for root-scrollability */}
      <PromptComposer
        isMobile={props.isMobile}
        queueLength={prompts.length}
        onDrawingStop={handleStopDrawing}
        onPromptEnqueue={handlePromptEnqueue}
        sx={{
          flex: 0,
          backgroundColor: 'background.level2',
          borderTop: `1px solid`,
          borderTopColor: 'divider',
          p: { xs: 1, md: 2 },
        }}
      />

    </Box>

    {/* AI Service Provider Options */}
    <ProviderConfigure
      providers={props.providers}
      activeProviderId={props.activeProviderId}
      setActiveProviderId={props.setActiveProviderId}
      sx={{
        backgroundColor: 'background.level1',
        borderTop: `1px solid`,
        borderTopColor: 'divider',
        p: { xs: 1, md: 2 },
      }}
    />

  </>;
}
