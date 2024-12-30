import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, SvgIconProps, Typography } from '@mui/joy';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import TelegramIcon from '@mui/icons-material/Telegram';

import { ChatMessageMemo } from '../../../apps/chat/components/message/ChatMessage';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';
import { animationEnterBelow } from '~/common/util/animUtils';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { BeamCard, beamCardClasses, beamCardMessageScrollingSx, beamCardMessageSx, beamCardMessageWrapperSx } from '../BeamCard';
import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { GATHER_COLOR, SCATTER_COLOR, SCATTER_RAY_SHOW_DRAG_HANDLE } from '../beam.config';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { rayIsError, rayIsImported, rayIsScattering, rayIsSelectable, rayIsUserSelected } from './beam.scatter';
import { useBeamCardScrolling, useBeamScatterShowLettering } from '../store-module-beam';
import { useMessageAvatarLabel } from '~/common/util/dMessageUtils';


/*const letterSx: SxProps = {
  width: '1rem',
  py: 0.25,
  fontSize: 'xs',
  boxShadow: 'xs',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '0.25rem',
  textAlign: 'center',
};*/

export const rayControlsSx: SxProps = {
  // layout
  display: 'flex', alignItems: 'center', gap: 1,
};

export const rayControlsMobileSx: SxProps = {
  ...rayControlsSx,

  // anchor top
  position: 'sticky', top: 0, bottom: 64,

  // looks (absorb parent padding, and overwrite with color and zIndex to stay on top)
  zIndex: 1,
  backgroundColor: 'inherit',
  mx: 'calc(-1 * var(--Card-padding))',
  px: 'var(--Card-padding)',
  my: -1,
  py: 1,
};

const RayControlsMemo = React.memo(RayControls);

function RayControls(props: {
  isEmpty: boolean,
  isMobile: boolean,
  isRemovable: boolean,
  isScattering: boolean,
  llmComponent: React.ReactNode,
  llmVendorIcon?: React.FunctionComponent<SvgIconProps>,
  onRemove: () => void,
  onToggleGenerate: () => void,
  rayLetter?: string,
  rayAvatarTooltip: React.ReactNode,
  // isLlmLinked: boolean,
  // onLink: () => void,
}) {
  return <Box sx={props.isMobile ? rayControlsMobileSx : rayControlsSx}>

    {/* Drag Handle */}
    {SCATTER_RAY_SHOW_DRAG_HANDLE && (
      <div style={{ display: 'flex' }}>
        <DragIndicatorIcon sx={{ fontSize: 'xl', my: 'auto' }} />
      </div>
    )}

    {/* Letter / LLM Icon (default) */}
    <TooltipOutlined asLargePane enableInteractive title={props.rayAvatarTooltip} placement='top-start'>
      <Box sx={{ display: 'flex' }}>
        {props.rayLetter ? (
          <Typography level='title-sm' color={SCATTER_COLOR !== 'neutral' ? SCATTER_COLOR : undefined}>
            {props.rayLetter}
          </Typography>
        ) : props.llmVendorIcon ? <props.llmVendorIcon sx={{ fontSize: 'lg' }} />
          : null
          // : <TextureIcon sx={{ fontSize: 'lg' }} />
        }
      </Box>
    </TooltipOutlined>

    <Box sx={{ flex: 1 }}>
      {props.llmComponent}
    </Box>

    {/*{!props.isLlmLinked && (*/}
    {/*  <GoodTooltip title={props.isLlmLinked ? undefined : 'Link to the Merge model'}>*/}
    {/*    <IconButton disabled={props.isLlmLinked || props.isScattering} size='sm' onClick={props.onLink}>*/}
    {/*      {props.isLlmLinked ? <LinkIcon /> : <LinkOffIcon />}*/}
    {/*    </IconButton>*/}
    {/*  </GoodTooltip>*/}
    {/*)}*/}

    {!props.isScattering ? (
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

    {props.isRemovable && (
      <GoodTooltip title='Remove'>
        <IconButton disabled={!props.isRemovable} size='sm' variant='plain' color='neutral' onClick={props.onRemove}>
          <RemoveCircleOutlineRoundedIcon />
        </IconButton>
      </GoodTooltip>
    )}
  </Box>;
}


export function BeamRay(props: {
  beamStore: BeamStoreApi,
  hadImportedRays: boolean,
  isMobile: boolean,
  isRemovable: boolean,
  rayId: string,
  rayIndexWeak: number,
  // linkedLlmId: DLLMId | null,
}) {

  // external state
  const ray = useBeamStore(props.beamStore, store => store.rays.find(ray => ray.rayId === props.rayId) ?? null);
  const cardScrolling = useBeamCardScrolling();
  const showLettering = useBeamScatterShowLettering();

  // derived state
  const isError = rayIsError(ray);
  const isScattering = rayIsScattering(ray);
  const isSelectable = rayIsSelectable(ray);
  const isSelected = rayIsUserSelected(ray);
  const isImported = rayIsImported(ray);
  const showUseButtons = isSelectable && !isScattering;
  const { removeRay, rayToggleScattering, raySetLlmId } = props.beamStore.getState();
  const { tooltip: rayAvatarTooltip } = useMessageAvatarLabel(ray?.message, 'pro');

  // This old code used the Gather LLM as Ray fallback - but now we use the last Scatter LLM as fallback
  // const isLlmLinked = !!props.linkedLlmId && !ray?.rayLlmId;
  // const llmId: DLLMId | null = isLlmLinked ? props.linkedLlmId : ray?.rayLlmId || null;
  // const handleLlmLink = React.useCallback(() => setLlmId(null), [setLlmId]);

  const llmId = ray?.rayLlmId ?? null;
  const setLlmId = React.useCallback((llmId: DLLMId | null) => raySetLlmId(props.rayId, llmId), [props.rayId, raySetLlmId]);
  const [_, llmComponent, llmVendorIcon] = useLLMSelect(
    llmId, setLlmId, '', true, isScattering,
  );


  // handlers

  const handleRayCopyToClipboard = React.useCallback(() => {
    const { rays } = props.beamStore.getState();
    const ray = rays.find(ray => ray.rayId === props.rayId);
    if (ray?.message.fragments.length)
      copyToClipboard(messageFragmentsReduceText(ray.message.fragments), 'Response');
  }, [props.beamStore, props.rayId]);

  const handleRayUse = React.useCallback(() => {
    // get snapshot values, so we don't have to react to the hook
    const { rays, onSuccessCallback } = props.beamStore.getState();
    const ray = rays.find(ray => ray.rayId === props.rayId);
    if (ray && ray.message.fragments.length && onSuccessCallback)
      onSuccessCallback(ray.message);
  }, [props.beamStore, props.rayId]);

  const handleRayRemove = React.useCallback(() => {
    removeRay(props.rayId);
  }, [props.rayId, removeRay]);

  const handleRayToggleGenerate = React.useCallback(() => {
    rayToggleScattering(props.rayId);
  }, [props.rayId, rayToggleScattering]);

  /*const handleRayToggleSelect = React.useCallback(() => {
    toggleUserSelection(props.rayId);
  }, [props.rayId, toggleUserSelection]);*/


  return (
    <BeamCard
      role='beam-card'
      tabIndex={-1}
      // onClick={isSelectable ? handleRayToggleSelect : undefined}
      className={
        (isError ? beamCardClasses.errored : '')
        + (isSelectable ? beamCardClasses.selectable + ' ' : '')
      }
    >

      {/* Controls Row */}
      <RayControlsMemo
        isEmpty={!isSelectable}
        isMobile={props.isMobile}
        isRemovable={props.isRemovable}
        isScattering={isScattering}
        llmComponent={llmComponent}
        llmVendorIcon={llmVendorIcon}
        onRemove={handleRayRemove}
        onToggleGenerate={handleRayToggleGenerate}
        rayLetter={showLettering ? 'R' + (1 + props.rayIndexWeak) : undefined}
        rayAvatarTooltip={rayAvatarTooltip}
        // isLlmLinked={isLlmLinked}
        // onLink={handleLlmLink}
      />

      {/* Show issue, if any */}
      {!!ray?.scatterIssue && <InlineError error={ray.scatterIssue} />}

      {/* Ray Message */}
      {(!!ray?.message?.fragments.length || ray?.status === 'scattering') && (
        <Box sx={beamCardMessageWrapperSx}>
          {!!ray.message && (
            <ChatMessageMemo
              message={ray.message}
              fitScreen={true}
              isMobile={props.isMobile}
              hideAvatar
              showUnsafeHtmlCode={true}
              adjustContentScaling={-1}
              sx={!cardScrolling ? beamCardMessageSx : beamCardMessageScrollingSx}
            />
          )}
        </Box>
      )}

      {/* Use Ray */}
      {showUseButtons && (
        <Box sx={{ mt: 'auto', mb: -1, mr: -1, placeSelf: 'end', height: 'calc(2.25rem - var(--Pad_2))', position: 'relative' }}>
          <Box sx={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            display: 'flex',
            gap: 1,
          }}>

            {/* Copy */}
            {!isImported && (
              <GoodTooltip title='Copy'>
                <IconButton
                  size='sm'
                  onClick={handleRayCopyToClipboard}
                >
                  <ContentCopyIcon sx={{ fontSize: 'md' }} />
                </IconButton>
              </GoodTooltip>
            )}

            {/* Continue */}
            <GoodTooltip title='Choose this message'>
              <IconButton
                size='sm'
                // variant='plain'
                color={GATHER_COLOR}
                disabled={isImported || isScattering}
                onClick={handleRayUse}
                // endDecorator={!isImported ? <TelegramIcon /> : null}
                sx={{
                  fontSize: 'xs',
                  // '--Icon-fontSize': 'var(--joy-fontSize-xl)',
                  px: isImported ? 1 : undefined,
                  animation: `${animationEnterBelow} 0.1s ease-out`,
                  whiteSpace: 'nowrap',
                }}
              >
                {isImported ? 'From Chat (copied)' : /*props.hadImportedRays ? 'Replace' : 'Use'*/ <TelegramIcon />}
              </IconButton>
            </GoodTooltip>

          </Box>
        </Box>
      )}

      {/* Readiness | Selection indicator */}
      {isSelected && (
        <Box sx={{
          display: 'flex',
          position: 'absolute',
          bottom: '0.5rem',
          right: '0.5rem',
        }}>
          <CheckCircleOutlineRoundedIcon sx={{ fontSize: 'md', color: 'success.solidBg' }} />
        </Box>
      )}
    </BeamCard>
  );
}