import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, styled } from '@mui/joy';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import { ChatMessageMemo } from '../../apps/chat/components/message/ChatMessage';

import type { DLLMId } from '~/modules/llms/store-llms';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { BeamStoreApi, useBeamStore } from './store-beam';


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


function StartStopButton(props: { isStarted: boolean, isFirstTime: boolean, onToggleGenerate: () => void }) {
  return !props.isStarted ? (
    <GoodTooltip title='Generate'>
      <IconButton size='sm' variant='plain' color='success' onClick={props.onToggleGenerate}>
        {props.isFirstTime ? <PlayArrowRoundedIcon /> : <ReplayRoundedIcon />}
      </IconButton>
    </GoodTooltip>
  ) : (
    <GoodTooltip title='Stop'>
      <IconButton size='sm' variant='plain' color='danger' onClick={props.onToggleGenerate}>
        <StopRoundedIcon />
      </IconButton>
    </GoodTooltip>
  );
}


export function BeamRay(props: {
  beamStore: BeamStoreApi,
  rayId: string
  isMobile: boolean,
  gatherLlmId: DLLMId | null,
}) {

  // external state
  const ray = useBeamStore(props.beamStore, (store) => store.rays.find(ray => ray.rayId === props.rayId) ?? null);

  // derived state
  const rayEmpty = !ray?.message?.updated;
  const rayScattering = !!ray?.genAbortController;
  const { removeRay, updateRay, toggleScattering } = props.beamStore.getState();

  const isLlmLinked = !!props.gatherLlmId && !ray?.scatterLlmId;
  const rayLlmId = isLlmLinked ? props.gatherLlmId : ray?.scatterLlmId || null;
  const setRayLlmId = React.useCallback((llmId: DLLMId | null) => {
    updateRay(props.rayId, { scatterLlmId: llmId });
  }, [props.rayId, updateRay]);
  const clearRayLlmId = React.useCallback(() => setRayLlmId(null), [setRayLlmId]);
  const [_rayLlm, rayLlmComponent] = useLLMSelect(
    rayLlmId, setRayLlmId,
    '', true, rayScattering,
  );


  // handlers

  const handleRayToggleGenerate = React.useCallback(() => {
    toggleScattering(props.rayId);
  }, [props.rayId, toggleScattering]);

  const handleRemoveRay = React.useCallback(() => {
    removeRay(props.rayId);
  }, [props.rayId, removeRay]);


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
        {!isLlmLinked && (
          <GoodTooltip title={isLlmLinked ? undefined : 'Link Model'}>
            <IconButton disabled={isLlmLinked || rayScattering} size='sm' onClick={clearRayLlmId}>
              {isLlmLinked ? <LinkIcon /> : <LinkOffIcon />}
            </IconButton>
          </GoodTooltip>
        )}

        {/* Start / Stop */}
        <StartStopButton
          isStarted={rayScattering}
          isFirstTime={rayEmpty}
          onToggleGenerate={handleRayToggleGenerate}
        />

        {/* Remove */}
        <GoodTooltip title='Remove'>
          <IconButton size='sm' variant='plain' color='neutral' onClick={handleRemoveRay}>
            <RemoveCircleOutlineRoundedIcon />
          </IconButton>
        </GoodTooltip>
      </Box>

      {/* Ray Message */}
      {(!!ray?.message && !rayEmpty) && (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          // uncomment the following to limit the message height
          // overflow: 'auto',
          // maxHeight: 'calc(0.8 * (100vh - 16rem))',
          // aspectRatio: 1,
        }}>
          <ChatMessageMemo
            message={ray.message}
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