import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, styled, Tooltip } from '@mui/joy';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import TelegramIcon from '@mui/icons-material/Telegram';

import { ChatMessageMemo } from '../../apps/chat/components/message/ChatMessage';

import type { DLLMId } from '~/modules/llms/store-llms';

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

  return (
    <RayCard>

      {/* Controls Row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {SHOW_DRAG_HANDLE && (
          <IconButton disabled size='sm' sx={undefined /*{ ml: 'calc(-0.5 * var(--Card-padding))' }*/}>
            <DragIndicatorIcon />
          </IconButton>
        )}
        <Box sx={{ flex: 1 }}>
          {rayLlmComponent}
        </Box>
        <Tooltip title={isLinked ? undefined : 'Link Model'}>
          <IconButton disabled={isLinked} size='sm' onClick={clearRayLlmId}>
            {isLinked ? <LinkIcon /> : <LinkOffIcon />}
          </IconButton>
        </Tooltip>
        <IconButton size='sm'>
          <TelegramIcon />
        </IconButton>
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