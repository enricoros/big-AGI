import * as React from 'react';

import { Box, IconButton } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TelegramIcon from '@mui/icons-material/Telegram';

import { ChatMessageMemo } from '../../../apps/chat/components/message/ChatMessage';

import { findLLMOrThrow } from '~/modules/llms/store-llms';
import { findVendorById } from '~/modules/llms/vendors/vendors.registry';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';
import { animationEnterBelow } from '~/common/util/animUtils';
import { copyToClipboard } from '~/common/util/clipboardUtils';

import { BeamCard, beamCardClasses, beamCardMessageScrollingSx, beamCardMessageSx, beamCardMessageWrapperSx } from '../BeamCard';
import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { FusionControlsMemo } from './FusionControls';
import { FusionInstructionsEditor } from './FusionInstructionsEditor';
import { GATHER_COLOR } from '../beam.config';
import { findFusionFactory } from './instructions/beam.gather.factories';
import { fusionIsEditable, fusionIsError, fusionIsFusing, fusionIsIdle, fusionIsStopped, fusionIsUsableOutput } from './beam.gather';
import { useBeamCardScrolling } from '../store-module-beam';


export function Fusion(props: {
  beamStore: BeamStoreApi,
  fusionId: string,
}) {

  // external state
  const fusion = useBeamStore(props.beamStore, store => store.fusions.find(fusion => fusion.fusionId === props.fusionId) ?? null);
  const cardScrolling = useBeamCardScrolling();

  // derived state
  const isEditable = fusionIsEditable(fusion);
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
        // (isIdle ? beamCardClasses.fusionIdle : '')
        (isError ? beamCardClasses.errored + ' ' : '')
        + ((isUsable || isFusing || isIdle) ? beamCardClasses.selectable + ' ' : '')
        + (isFusing ? beamCardClasses.attractive + ' ' : '')
        // + (beamCardClasses.smashTop + ' ')
      }
    >

      {/* Controls Row */}
      <FusionControlsMemo
        fusion={fusion}
        factory={factory}
        isFusing={isFusing}
        isInterrupted={isStopped}
        isUsable={isUsable}
        llmLabel={llmLabel}
        llmVendorIcon={llmVendorIcon}
        onRemove={handleFusionRemove}
        onToggleGenerate={handleToggleFusionGather}
      />

      {isEditable && (
        <FusionInstructionsEditor
          beamStore={props.beamStore}
          factory={factory}
          fusionId={props.fusionId}
          instructions={fusion.instructions}
          isFusing={isFusing}
          isIdle={isIdle}
          onStart={handleToggleFusionGather}
        />
      )}

      {/* Show issue, if any */}
      {isError && <InlineError error={fusion?.errorText || 'Merge Issue'} />}


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
              showUnsafeHtml={true}
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
              // variant='plain'
              color={GATHER_COLOR}
              disabled={isFusing}
              onClick={handleFusionUse}
              // endDecorator={<TelegramIcon />}
              sx={{
                // ...BEAM_BTN_SX,
                fontSize: 'xs',
                // '--Icon-fontSize': 'var(--joy-fontSize-xl)',
                // backgroundColor: 'background.popup',
                // border: '1px solid',
                // borderColor: `${GATHER_COLOR}.outlinedBorder`,
                // boxShadow: `0 4px 16px -4px rgb(var(--joy-palette-${GATHER_COLOR}-mainChannel) / 20%)`,
                animation: `${animationEnterBelow} 0.1s ease-out`,
                whiteSpace: 'nowrap',
              }}
            >
              {/*Use*/}
              <TelegramIcon />
            </IconButton>
          </GoodTooltip>

        </Box>
      )}

    </BeamCard>
  );
}