import * as React from 'react';

import { Box, IconButton } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TelegramIcon from '@mui/icons-material/Telegram';

import type { AixReattachMode } from '~/modules/aix/client/aix.client';

import { ChatMessageMemo } from '../../../apps/chat/components/message/ChatMessage';

import { DLLMId, getLLMLabel } from '~/common/stores/llms/llms.types';
import type { DMessageFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import type { DMessageId } from '~/common/stores/chat/chat.message';
import { messageFragmentsReduceText, messageWasOutOfTokens } from '~/common/stores/chat/chat.message';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';
import { animationEnterBelow } from '~/common/util/animUtils';
import { clipboardInterceptCtrlCForCleanup, copyToClipboard } from '~/common/util/clipboardUtils';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { BeamCard, beamCardClasses, beamCardMessageScrollingSx, beamCardMessageSx, beamCardMessageWrapperSx } from '../BeamCard';
import { BeamUpstreamResume } from '../BeamUpstreamResume';
import { BeamCardNotice, BeamModelUnavailable } from '../components/BeamCardNotice';
import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { FusionControlsMemo } from './FusionControls';
import { FusionInputsWait } from './FusionInputsWait';
import { FusionInstructionsEditor } from './FusionInstructionsEditor';
import { GATHER_COLOR } from '../beam.config';
import { findFusionFactory, fusionCardTitle } from './instructions/beam.gather.factories';
import { fusionIsEditable, fusionIsError, fusionIsFusing, fusionIsIdle, fusionIsStopped, fusionIsUsableOutput, fusionIsWaiting } from './beam.gather';
import { beamStoreGatherInputsNextCount } from './beam.gather.inputs';
import { useBeamCardScrolling } from '../store-module-beam';
import { messageIssueColor, useMessageAvatarLabel } from '~/common/util/dMessageUtils';


export function Fusion(props: {
  beamStore: BeamStoreApi,
  fusionId: string,
  isMobile: boolean,
}) {

  // state
  const [showLlmSelector, setShowLlmSelector] = React.useState(false);

  // external state
  const fusion = useBeamStore(props.beamStore, ({ fusions }) => fusions.find(fusion => fusion.fusionId === props.fusionId) ?? null);
  const nextCount = useBeamStore(props.beamStore, beamStoreGatherInputsNextCount);
  const cardScrolling = useBeamCardScrolling();

  // derived state
  const isEditable = fusionIsEditable(fusion);
  const isIdle = fusionIsIdle(fusion);
  const isError = fusionIsError(fusion);
  const isFusing = fusionIsFusing(fusion);
  const isWaiting = fusionIsWaiting(fusion);
  const isStopped = fusionIsStopped(fusion);
  const isUsable = fusionIsUsableOutput(fusion);
  const showUseButtons = isUsable && !isFusing;
  const { tooltip: fusionAvatarTooltip } = useMessageAvatarLabel(fusion?.outputDMessage, 'pro');
  const isOutOfTokens = !isFusing && messageWasOutOfTokens(fusion?.outputDMessage?.generator);
  const issueColor = messageIssueColor(isError, isOutOfTokens);

  const factory = findFusionFactory(fusion?.factoryId);
  // counted title: 'Combined N' after a completed run; 'Combine N' otherwise, with the interrupted run's count or the next run's (a pending restart shows the next run)
  const recordedCount = fusion?.inputsWait ? undefined : fusion?.fusedInputsCount;
  const cardTitle = !factory ? '' : fusionCardTitle(factory,
    (fusion?.stage === 'stopped' && recordedCount !== undefined) ? recordedCount : nextCount,
    fusion?.stage === 'success' ? recordedCount : undefined
  );

  const { removeFusion, toggleFusionGathering, fusionSetLlmId } = props.beamStore.getState();

  // get LLM Label and Vendor Icon
  const llmId = fusion?.llmId ?? null;
  const setLlmId = React.useCallback((llmId: DLLMId | null) => fusionSetLlmId(props.fusionId, llmId), [props.fusionId, fusionSetLlmId]);
  const [llmOrNull, llmComponent] = useLLMSelect(llmId, setLlmId, {
    label: '',
    disabled: isFusing,
    showStarFilter: true,
  });

  // hide selector when fusion starts
  React.useEffect(() => {
    isFusing && setShowLlmSelector(false);
  }, [isFusing]);

  // more derived
  const llmLabel = llmOrNull ? getLLMLabel(llmOrNull) : 'Model unknown';

  // handlers
  const handleFusionCopyToClipboard = React.useCallback(() => {
    const { fusions } = props.beamStore.getState();
    const fusion = fusions.find(fusion => fusion.fusionId === props.fusionId);
    if (fusion?.outputDMessage?.fragments.length)
      copyToClipboard(messageFragmentsReduceText(fusion.outputDMessage.fragments), 'Merge');
  }, [props.beamStore, props.fusionId]);

  const handleFusionUse = React.useCallback(() => {
    // get snapshot values, so we don't have to react to the hook
    const { fusions, onSuccessCallback } = props.beamStore.getState();
    const fusion = fusions.find(fusion => fusion.fusionId === props.fusionId);
    if (fusion?.outputDMessage?.fragments.length && onSuccessCallback)
      onSuccessCallback(fusion.outputDMessage);
  }, [props.beamStore, props.fusionId]);

  const handleFusionReattach = React.useCallback((mode: AixReattachMode) => {
    props.beamStore.getState().fusionReattach(props.fusionId, mode);
  }, [props.beamStore, props.fusionId]);

  const handleFusionClearUpstreamHandle = React.useCallback(() => {
    props.beamStore.getState().fusionClearUpstreamHandle(props.fusionId);
  }, [props.beamStore, props.fusionId]);

  const handleIconClick = React.useCallback((event: React.MouseEvent) => {
    if (event.shiftKey) {
      const fusion = props.beamStore.getState().fusions.find(fusion => fusion.fusionId === props.fusionId);
      console.log({ fusion });
      return;
    }
    // Toggle LLM selector
    setShowLlmSelector(!showLlmSelector);
  }, [showLlmSelector, props.beamStore, props.fusionId]);

  const handleFusionRemove = React.useCallback(() => {
    removeFusion(props.fusionId);
  }, [props.fusionId, removeFusion]);

  const handleToggleFusionGather = React.useCallback(() => {
    toggleFusionGathering(props.fusionId);
  }, [props.fusionId, toggleFusionGathering]);

  const handleFragmentDelete = React.useCallback((messageId: DMessageId, fragmentId: DMessageFragmentId) => {
    const { fusions, fusionDeleteFragment } = props.beamStore.getState();
    const fusion = fusions.find(f => f.outputDMessage?.id === messageId);
    if (fusion)
      fusionDeleteFragment(fusion.fusionId, fragmentId);
  }, [props.beamStore]);

  const handleFragmentReplace = React.useCallback((messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => {
    const { fusions, fusionReplaceFragment } = props.beamStore.getState();
    const fusion = fusions.find(f => f.outputDMessage?.id === messageId);
    if (fusion)
      fusionReplaceFragment(fusion.fusionId, fragmentId, newFragment);
  }, [props.beamStore]);

  // escape hatch: no factory, no fusion - nothing to do
  if (!fusion || !factory)
    return;

  return (
    <BeamCard
      role='beam-card'
      tabIndex={-1}
      className={
        // (isIdle ? beamCardClasses.fusionIdle : '')
        (issueColor ? beamCardClasses.issue[issueColor] + ' ' : '')
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
        isWaiting={isWaiting}
        cardTitle={cardTitle}
        isInterrupted={isStopped}
        isMobile={props.isMobile}
        isUsable={isUsable}
        llmComponent={(isFusing || (!isEditable && !showLlmSelector)) ? undefined : llmComponent}
        llmLabel={llmLabel}
        llmVendorId={llmOrNull?.vId}
        fusionAvatarTooltip={fusionAvatarTooltip}
        onIconClick={isFusing ? undefined : handleIconClick}
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

      {/* Selected model no longer exists (e.g. stale team) */}
      <BeamModelUnavailable llmId={llmId} resolved={!!llmOrNull} />

      {/* Show issue, if any */}
      {isError && <InlineError error={fusion?.errorText || 'Merge Issue'} />}
      {issueColor === 'warning' && <BeamCardNotice color='warning' variant='solid' fullWidth>Out of tokens - response cut short.</BeamCardNotice>}


      {/* Start requested, waiting for the replies still generating */}
      {!!fusion.inputsWait && <FusionInputsWait beamStore={props.beamStore} inputsWait={fusion.inputsWait} />}

      {/* Dynamic: instruction-specific components */}
      {!!fusion?.fusingInstructionComponent && fusion.fusingInstructionComponent}

      {/* Output Message */}
      {(!!fusion?.outputDMessage?.fragments.length || fusion?.stage === 'fusing') && (
        <Box onCopy={clipboardInterceptCtrlCForCleanup} sx={beamCardMessageWrapperSx}>
          {!!fusion.outputDMessage?.fragments.length && (
            <ChatMessageMemo
              message={fusion.outputDMessage}
              fitScreen={true}
              isMobile={props.isMobile}
              hideAvatar
              blocksStretch
              htmlRenderVariant='render'
              adjustContentScaling={-1}
              onMessageFragmentDelete={handleFragmentDelete}
              onMessageFragmentReplace={handleFragmentReplace}
              sx={!cardScrolling ? beamCardMessageSx : beamCardMessageScrollingSx}
            />
          )}
        </Box>
      )}

      {/* Gemini Interactions (Deep Research) resume - state-gated: only when idle with a live upstream handle */}
      <BeamUpstreamResume
        llmId={fusion?.llmId ?? null}
        generator={fusion?.outputDMessage?.generator}
        isPending={isFusing || isWaiting}
        onReattach={handleFusionReattach}
        onClearHandle={handleFusionClearUpstreamHandle}
      />


      {/* Use Fusion */}
      {showUseButtons && (
        <Box sx={{ mt: 'auto', mb: -1, mr: -1, placeSelf: 'end', display: 'flex', gap: 1 }}>

          {/* Copy */}
          <GoodTooltip title='Copy'>
            <IconButton
              onClick={handleFusionCopyToClipboard}
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