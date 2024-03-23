import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TelegramIcon from '@mui/icons-material/Telegram';

import { ChatMessageMemo } from '../../../apps/chat/components/message/ChatMessage';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';
import { copyToClipboard } from '~/common/util/clipboardUtils';

import { BeamCard, beamCardClasses } from '../BeamCard';
import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { fusionIsError, fusionIsFusing, fusionIsIdle, fusionIsUsable } from './beam.gather';


const fusionCardSx: SxProps = {
  mx: 'var(--Pad)',
  mt: 'calc(-1 * var(--Pad))', // absorb gap to the prev-bottom

  // boxShadow: 'sm',
  // borderColor: 'success.outlinedBorder',
  borderTop: 'none',
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
  const isUsable = fusionIsUsable(fusion);
  const showUseButtons = isUsable && !isFusing;


  // handlers
  const handleFusionCopy = React.useCallback(() => {
    const { _currentFusion } = props.beamStore.getState();
    const fusion = _currentFusion();
    if (fusion?.outputMessage?.text)
      copyToClipboard(fusion.outputMessage.text, 'Fusion');
  }, [props.beamStore]);

  const handleFusionUse = React.useCallback(() => {
    // get snapshot values, so we don't have to react to the hook
    const { _currentFusion, onSuccessCallback, gatherLlmId } = props.beamStore.getState();
    const fusion = _currentFusion();
    if (fusion?.outputMessage?.text && onSuccessCallback)
      onSuccessCallback(fusion.outputMessage.text, gatherLlmId || '');
  }, [props.beamStore]);


  if (!fusion || (isIdle && !isError))
    return null;

  return (
    <Box>
      <BeamCard
        className={beamCardClasses.selectable}
        sx={fusionCardSx}
      >

        {/* Show issue, if any */}
        {isError && <InlineError error={fusion.fusionIssue || 'Merge Issue'} />}

        {!!fusion.outputMessage && (
          <ChatMessageMemo
            message={fusion.outputMessage}
            fitScreen={props.isMobile}
            showAvatar={false}
            adjustContentScaling={-1}
            sx={fusionChatMessageSx}
          />
        )}


        {/* Use Fusion */}
        {showUseButtons && (
          <Box sx={{ mt: 'auto', mb: -1, mr: -1, placeSelf: 'end', height: 'calc(2.5rem - var(--Pad_2))', position: 'relative' }}>
            <Box sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              display: 'flex',
              gap: 1,
            }}>
              {/* Copy */}
              <GoodTooltip title='Copy'>
                <IconButton
                  size='sm'
                  onClick={handleFusionCopy}
                >
                  <ContentCopyIcon sx={{ fontSize: 'md' }} />
                </IconButton>
              </GoodTooltip>

              {/* Continue */}
              <GoodTooltip title='Accept this message'>
                <IconButton
                  size='sm'
                  color='success'
                  disabled={isFusing}
                  onClick={handleFusionUse}
                  sx={{
                    fontSize: 'xs',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <TelegramIcon />
                </IconButton>
              </GoodTooltip>
            </Box>
          </Box>
        )}

      </BeamCard>
    </Box>
  );
}