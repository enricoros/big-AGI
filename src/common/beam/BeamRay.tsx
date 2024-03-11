import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, styled } from '@mui/joy';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import { ChatMessageMemo } from '../../apps/chat/components/message/ChatMessage';

import type { DLLMId } from '~/modules/llms/store-llms';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { BeamStoreApi, useBeamStoreRay } from './store-beam';


// component configuration
const SHOW_DRAG_HANDLE = false;


const rayCardClasses = {
  active: 'beamRay-Active',
} as const;

export const RayCard = styled(Box)(({ theme }) => ({
  '--Card-padding': '1rem',

  backgroundColor: theme.vars.palette.background.surface,
  border: '1px solid',
  borderColor: theme.vars.palette.neutral.outlinedBorder,
  borderRadius: theme.radius.md,

  padding: 'var(--Card-padding)',

  [`&.${rayCardClasses.active}`]: {
    boxShadow: 'inset 0 0 0 2px #00f, inset 0 0 0 4px #00a',
  },

  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--Pad_2)',

  // uncomment the following to limit the card height
  // maxHeight: 'calc(0.8 * (100dvh - 16rem))',
  // overflow: 'auto',
}));
RayCard.displayName = 'RayCard';


const chatMessageEmbeddedSx: SxProps = {
  // style: to undo the style of ChatMessage
  border: 'none',
  mx: -1.5, // compensates for the marging (e.g. RenderChatText, )
  my: 0,
  px: 0,
  py: 0,
} as const;


function StartStopButton(props: {
  isStarted: boolean,
  isStopped: boolean,
  onStart: () => void,
  onStop: () => void,
}) {
  return (
    <>
      {props.isStopped && (
        <GoodTooltip title='Start Single'>
          <IconButton size='sm' variant='plain' color='success' onClick={props.onStart}>
            <PlayArrowRoundedIcon />
          </IconButton>
        </GoodTooltip>
      )}
      {props.isStarted && (
        <GoodTooltip title='Start Single'>
          <IconButton size='sm' variant='plain' color='danger' onClick={props.onStop}>
            <StopRoundedIcon />
          </IconButton>
        </GoodTooltip>
      )}
    </>
  );
}


export function BeamRay(props: {
  beamStore: BeamStoreApi,
  index: number,
  isMobile: boolean,
  gatherLlmId: DLLMId | null,
}) {

  // external state
  const { dRay, setRayLlmId, clearRayLlmId } = useBeamStoreRay(props.beamStore, props.index);
  const isLinked = !!props.gatherLlmId && !dRay.scatterLlmId;
  const [rayLlm, rayLlmComponent] = useLLMSelect(isLinked ? props.gatherLlmId : dRay.scatterLlmId, setRayLlmId, '', true);


  const handleStart = React.useCallback(() => {

  }, []);

  const handleStop = React.useCallback(() => {

  }, []);

  const isStopped = !dRay.genAbortController;

  return (
    <RayCard>

      {/* Controls Row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Drag */}
        {SHOW_DRAG_HANDLE && (
          <IconButton disabled size='sm' sx={undefined /*{ ml: 'calc(-0.5 * var(--Card-padding))' }*/}>
            <DragIndicatorIcon />
          </IconButton>
        )}

        {/* LLM Selector*/}
        <Box sx={{ flex: 1 }}>
          {rayLlmComponent}
        </Box>
        {/* Linker */}
        <GoodTooltip title={isLinked ? undefined : 'Link Model'}>
          <IconButton disabled={isLinked} size='sm' onClick={clearRayLlmId}>
            {isLinked ? <LinkIcon /> : <LinkOffIcon />}
          </IconButton>
        </GoodTooltip>

        {/* Start / Stop */}
        <StartStopButton
          isStarted={!isStopped}
          isStopped={isStopped}
          onStart={handleStart}
          onStop={handleStop}
        />
      </Box>

      {/* Ray Message */}
      {(!!dRay.message && !!dRay.message.updated) && (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          // uncomment the following to limit the message height
          // overflow: 'auto',
          // maxHeight: 'calc(0.8 * (100vh - 16rem))',
          // aspectRatio: 1,
        }}>
          <ChatMessageMemo
            message={dRay.message}
            fitScreen={props.isMobile}
            showAvatar={false}
            adjustContentScaling={-1}
            sx={chatMessageEmbeddedSx}
          />
        </Box>
      )}

    </RayCard>
  );
}