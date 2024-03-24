import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, IconButton, Typography } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TelegramIcon from '@mui/icons-material/Telegram';

import { ChatMessageMemo } from '../../../apps/chat/components/message/ChatMessage';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';
import { animationEnterBelow } from '~/common/util/animUtils';
import { copyToClipboard } from '~/common/util/clipboardUtils';

import { BEAM_BTN_SX, BEAM_INVERT_BACKGROUND, GATHER_COLOR } from '../beam.config';
import { BeamCard, beamCardClasses } from '../BeamCard';
import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { fusionIsError, fusionIsFusing, fusionIsIdle, fusionIsUsableOutput } from './beam.gather';


const outputWrapperSx: SxProps = {
  mt: 'calc(-1 * var(--Pad))', // absorb parent 'gap' to previous
  px: 'var(--Pad)',
  pb: 'var(--Pad_2)',
};

const outputWrapperINVSx: SxProps = {
  ...outputWrapperSx,
  backgroundColor: 'neutral.solidBg',
};


const fusionCardSx: SxProps = {
  // [`&.${beamCardClasses.idle}`]: {
  //   pb: 0, // Peekaboo (shrink height)
  // },

  // boxShadow: 'sm',
  // borderColor: `${GATHER_COLOR}.outlinedBorder`,
  borderTop: 'none',
  // borderRadius: 'sm',
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
};

const fusionChatMessageSx: SxProps = {
  // style: to undo the style of ChatMessage
  backgroundColor: 'none',
  border: 'none',
  mx: -1.5, // compensates for the marging (e.g. RenderChatText, )
  my: 0,
  px: 0,
  py: 0,
} as const;


// const placeholderMessage = createDMessage('assistant', 'Click the Merge button to combine the Beams.');


export function BeamGatherOutput(props: {
  isMobile: boolean,
  beamStore: BeamStoreApi
}) {

  // external state - we work on 'currentFusionId'
  const { fusion } = useBeamStore(props.beamStore, useShallow(store => {
    const fusion = store.currentFusionId !== null ? store.fusions.find(fusion => fusion.fusionId === store.currentFusionId) ?? null : null;
    return {
      fusion,
    };
  }));

  // derived state
  const isIdle = fusionIsIdle(fusion);
  const isError = fusionIsError(fusion);
  const isFusing = fusionIsFusing(fusion);
  const isUsableOutput = fusionIsUsableOutput(fusion);
  const showUseOutputButtons = isUsableOutput && !isFusing;


  // handlers
  const handleFusionCopy = React.useCallback(() => {
    const { _currentFusion } = props.beamStore.getState();
    const fusion = _currentFusion();
    if (fusion?.outputDMessage?.text)
      copyToClipboard(fusion.outputDMessage.text, 'Fusion');
  }, [props.beamStore]);

  const handleFusionUse = React.useCallback(() => {
    // get snapshot values, so we don't have to react to the hook
    const { _currentFusion, onSuccessCallback, gatherLlmId } = props.beamStore.getState();
    const fusion = _currentFusion();
    if (fusion?.outputDMessage?.text && onSuccessCallback)
      onSuccessCallback(fusion.outputDMessage.text, gatherLlmId || '');
  }, [props.beamStore]);

  // if (isIdle)
  //   return null;

  return (
    <Box sx={BEAM_INVERT_BACKGROUND ? outputWrapperINVSx : outputWrapperSx}>
      <BeamCard
        className={`${isIdle ? beamCardClasses.idle : ''} ${showUseOutputButtons ? beamCardClasses.selectable : ''}`}
        sx={fusionCardSx}
      >

        {/* Show issue, if any */}
        {isError && <InlineError error={fusion?.errorText || 'Merge Issue'} />}

        {!!fusion?.fusingProgressComponent && (
          <Typography level='body-xs'>
            {fusion.fusingProgressComponent}
          </Typography>
        )}

        {/* Output */}
        {!!fusion?.outputDMessage && (
          <ChatMessageMemo
            message={fusion.outputDMessage}
            fitScreen={props.isMobile}
            showAvatar={false}
            adjustContentScaling={-1}
            sx={fusionChatMessageSx}
          />
        )}

        {/* Use Output */}
        {showUseOutputButtons && (
          <Box sx={{ mt: 'auto', placeSelf: 'end', display: 'flex', gap: 3 }}>

            {/* Copy */}
            <GoodTooltip title='Copy'>
              <IconButton
                onClick={handleFusionCopy}
              >
                <ContentCopyIcon sx={{ fontSize: 'md' }} />
              </IconButton>
            </GoodTooltip>

            {/* Continue */}
            <GoodTooltip title='Use this message'>
              <Button
                variant='solid' color={GATHER_COLOR}
                disabled={isFusing}
                onClick={handleFusionUse}
                endDecorator={<TelegramIcon />}
                sx={{
                  ...BEAM_BTN_SX,
                  whiteSpace: 'nowrap',
                  // backgroundColor: 'background.popup',
                  // border: '1px solid',
                  // borderColor: `${GATHER_COLOR}.outlinedBorder`,
                  boxShadow: `0 4px 16px -4px rgb(var(--joy-palette-${GATHER_COLOR}-mainChannel) / 20%)`,
                  animation: `${animationEnterBelow} 0.1s ease-out`,
                }}
              >
                Ok
              </Button>
            </GoodTooltip>

          </Box>
        )}

      </BeamCard>
    </Box>
  );
}