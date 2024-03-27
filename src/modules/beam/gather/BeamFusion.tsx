import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, SvgIconProps, Typography } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import TelegramIcon from '@mui/icons-material/Telegram';

import { ChatMessageMemo } from '../../../apps/chat/components/message/ChatMessage';

import { findVendorById } from '~/modules/llms/vendors/vendors.registry';
import { findLLMOrThrow } from '~/modules/llms/store-llms';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';
import { animationEnterBelow } from '~/common/util/animUtils';
import { copyToClipboard } from '~/common/util/clipboardUtils';

import { BFusion, fusionIsError, fusionIsFusing, fusionIsIdle, fusionIsStopped, fusionIsUsableOutput } from './beam.gather';
import { BeamCard, beamCardClasses, beamCardMessageScrollingSx, beamCardMessageSx, beamCardMessageWrapperSx } from '../BeamCard';
import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { GATHER_COLOR } from '../beam.config';
import { findFusionFactory, FusionFactorySpec } from './instructions/beam.gather.factories';
import { useBeamCardScrolling } from '../store-module-beam';


const fusionCardSx: SxProps = {
  // [`&.${beamCardClasses.idle}`]: {
  //   pb: 0, // Peekaboo (shrink height)
  // },

  // boxShadow: 'sm',
  // borderColor: `${GATHER_COLOR}.outlinedBorder`,
};


const FusionControlsMemo = React.memo(FusionControls);

function FusionControls(props: {
  fusion: BFusion,
  factory: FusionFactorySpec,
  isEmpty: boolean,
  isFusing: boolean,
  isStopped: boolean,
  llmLabel: string,
  llmVendorIcon?: React.FunctionComponent<SvgIconProps>,
  onRemove: () => void,
  onToggleGenerate: () => void,
}) {


  return (
    <Box
      // color='success'
      // variant='solid'
      // invertedColors
      sx={{
        // mx: -1, mt: -1, px: 1, py: 0,
        borderRadius: 'sm',
        display: 'flex', alignItems: 'center', gap: 1,
      }}
    >

      {/* LLM Icon */}
      {!!props.llmVendorIcon && (
        <GoodTooltip title={props.llmLabel}>
          <Box sx={{ display: 'flex' }}>
            <props.llmVendorIcon sx={{ fontSize: 'lg', my: 'auto' }} />
          </Box>
        </GoodTooltip>
      )}

      {/* Factory Icon */}
      {!!props.factory.Icon && (
        <props.factory.Icon sx={{ fontSize: 'lg', my: 'auto' }} />
      )}

      {/* Title / Progress Component */}
      <Box sx={{
        flex: 1,
        // ml: -1, my: -1, pl: 1, py: 0.5, borderRadius: 'md',
        display: 'flex',
        alignItems: 'center',
      }}>
        {props.fusion.fusingProgressComponent
          // Show the progress in place of the title
          ? props.fusion.fusingProgressComponent
          : (
            <Typography sx={{ fontSize: 'sm', fontWeight: 'md' }}>
              {props.factory.label + ' Merge'} {props.isStopped && <em> - Interrupted</em>}
            </Typography>
          )}
      </Box>

      {!props.isFusing ? (
        <GoodTooltip title='Generate'>
          <IconButton size='sm' variant='plain' color='success' onClick={props.onToggleGenerate}>
            {props.isEmpty ? <PlayArrowRoundedIcon sx={{ fontSize: 'xl2' }} /> : <ReplayRoundedIcon />}
          </IconButton>
        </GoodTooltip>
      ) : (
        <GoodTooltip title='Stop'>
          <IconButton size='sm' variant='plain' color='danger' onClick={props.onToggleGenerate}>
            <StopRoundedIcon />
          </IconButton>
        </GoodTooltip>
      )}

      <GoodTooltip title='Remove'>
        <IconButton size='sm' variant='plain' color='neutral' onClick={props.onRemove}>
          <RemoveCircleOutlineRoundedIcon />
        </IconButton>
      </GoodTooltip>
    </Box>
  );
}


export function BeamFusion(props: {
  beamStore: BeamStoreApi,
  fusionId: string,
}) {

  // external state
  const fusion = useBeamStore(props.beamStore, store => store.fusions.find(fusion => fusion.fusionId === props.fusionId) ?? null);
  const cardScrolling = useBeamCardScrolling();

  // derived state
  const isIdle = fusionIsIdle(fusion);
  const isError = fusionIsError(fusion);
  const isFusing = fusionIsFusing(fusion);
  const isStopped = fusionIsStopped(fusion);
  const isUsable = fusionIsUsableOutput(fusion);
  const showUseButtons = isUsable && !isFusing;

  const factory = findFusionFactory(fusion?.factoryId);

  const { removeFusion, toggleFusionGathering } = props.beamStore.getState();


  // get LLM Label and Vendor Icon
  const llmId = fusion?.llmId ?? null;
  const { llmLabel, llmVendorIcon } = React.useMemo(() => {
    if (llmId) {
      try {
        const llm = findLLMOrThrow(llmId);
        return {
          llmLabel: llm.label,
          llmVendorIcon: findVendorById(llm._source?.vId)?.Icon,
        };
      } catch (e) {
      }
    }
    return { llmLabel: 'Model unknown', llmVendorIcon: undefined };
  }, [llmId]);


  // handlers
  const handleFusionCopy = React.useCallback(() => {
    const { fusions } = props.beamStore.getState();
    const fusion = fusions.find(fusion => fusion.fusionId === props.fusionId);
    if (fusion?.outputDMessage?.text)
      copyToClipboard(fusion.outputDMessage.text, 'Merge');
  }, [props.beamStore, props.fusionId]);

  const handleFusionUse = React.useCallback(() => {
    // get snapshot values, so we don't have to react to the hook
    const { fusions, onSuccessCallback } = props.beamStore.getState();
    const fusion = fusions.find(fusion => fusion.fusionId === props.fusionId);
    if (fusion?.outputDMessage?.text && onSuccessCallback)
      onSuccessCallback(fusion.outputDMessage.text, fusion.llmId || '');
  }, [props.beamStore, props.fusionId]);


  const handleFusionRemove = React.useCallback(() => {
    removeFusion(props.fusionId);
  }, [props.fusionId, removeFusion]);

  const handleToggleFusionGather = React.useCallback(() => {
    toggleFusionGathering(props.fusionId);
  }, [props.fusionId, toggleFusionGathering]);

  // escape hatch: no factory, no fusion - nothing to do
  if (!fusion || !factory)
    return;

  return (
    <BeamCard
      className={
        (isIdle ? beamCardClasses.idle : '')
        + (isError ? beamCardClasses.errored + ' ' : '')
        + (isUsable ? beamCardClasses.selectable + ' ' : '')
        + (isFusing ? beamCardClasses.attractive + ' ' : '')
        // + (beamCardClasses.smashTop + ' ')
      }
    >

      {/* Controls Row */}
      <FusionControlsMemo
        fusion={fusion}
        factory={factory}
        isEmpty={!isUsable}
        isFusing={isFusing}
        isStopped={isStopped}
        llmLabel={llmLabel}
        llmVendorIcon={llmVendorIcon}
        onRemove={handleFusionRemove}
        onToggleGenerate={handleToggleFusionGather}
      />


      {/* Show issue, if any */}
      {isError && <InlineError error={fusion?.errorText || 'Merge Issue'} />}

      {/* Dyanmic: the progress, set by the execution chain */}
      {/*{fusion?.fusingProgressComponent && fusion.fusingProgressComponent}*/}

      {/* Dynamic: instruction-specific components */}
      {!!fusion?.fusingInstructionComponent && fusion.fusingInstructionComponent}


      {/* Output Message */}
      {(!!fusion?.outputDMessage?.text || fusion?.stage === 'fusing') && (
        <Box sx={beamCardMessageWrapperSx}>
          {!!fusion.outputDMessage && (
            <ChatMessageMemo
              message={fusion.outputDMessage}
              fitScreen={true}
              showAvatar={false}
              adjustContentScaling={-1}
              sx={!cardScrolling ? beamCardMessageSx : beamCardMessageScrollingSx}
            />
          )}
        </Box>
      )}

      {/* Use Fusion */}
      {showUseButtons && (
        <Box sx={{ mt: 'auto', mb: -1, mr: -1, placeSelf: 'end', display: 'flex', gap: 1 }}>

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
            <IconButton
              size='sm'
              // variant='solid'
              color={GATHER_COLOR}
              disabled={isFusing}
              onClick={handleFusionUse}
              // endDecorator={<TelegramIcon />}
              sx={{
                // ...BEAM_BTN_SX,
                // fontSize: 'xs',
                // backgroundColor: 'background.popup',
                // border: '1px solid',
                // borderColor: `${GATHER_COLOR}.outlinedBorder`,
                // boxShadow: `0 4px 16px -4px rgb(var(--joy-palette-${GATHER_COLOR}-mainChannel) / 20%)`,
                animation: `${animationEnterBelow} 0.1s ease-out`,
                // whiteSpace: 'nowrap',
              }}
            >
              {/*Ok*/}
              <TelegramIcon />
            </IconButton>
          </GoodTooltip>

        </Box>
      )}

    </BeamCard>
  );
}