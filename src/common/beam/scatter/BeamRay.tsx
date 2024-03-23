import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, SvgIconProps } from '@mui/joy';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import TelegramIcon from '@mui/icons-material/Telegram';

import { ChatMessageMemo } from '../../../apps/chat/components/message/ChatMessage';

import type { DLLMId } from '~/modules/llms/store-llms';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { BeamCard, beamCardClasses } from '../BeamCard';
import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { SCATTER_RAY_SHOW_DRAG_HANDLE } from '../beam.config';
import { rayIsError, rayIsImported, rayIsScattering, rayIsSelectable, rayIsUserSelected } from './beam.scatter';
import { useBeamRayScrolling } from './BeamScatterPaneDropdown';


const chatMessageEmbeddedSx: SxProps = {
  // style: to undo the style of ChatMessage
  backgroundColor: 'none',
  border: 'none',
  mx: -1.5, // compensates for the marging (e.g. RenderChatText, )
  my: 0,
  px: 0,
  py: 0,
};

const chatMessageEmbeddedScrollingSx: SxProps = {
  ...chatMessageEmbeddedSx,
  overflow: 'auto',
  maxHeight: 'max(320px, calc(60lvh - 16rem))',
};

/*const letterSx: SxProps = {
  width: '1rem',
  py: 0.25,
  fontSize: 'xs',
  backgroundColor: 'background.popup',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 'xs',
  textAlign: 'center',
};*/


const RayControlsMemo = React.memo(RayControls);

function RayControls(props: {
  // rayIndex: number
  isEmpty: boolean,
  isLlmLinked: boolean,
  isRemovable: boolean,
  isScattering: boolean,
  llmComponent: React.ReactNode,
  llmVendorIcon?: React.FunctionComponent<SvgIconProps>,
  onLink: () => void,
  onRemove: () => void,
  onToggleGenerate: () => void,
}) {
  return <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

    {/* Drag Handle */}
    {SCATTER_RAY_SHOW_DRAG_HANDLE && (
      <div style={{ display: 'flex' }}>
        <DragIndicatorIcon sx={{ fontSize: 'xl', my: 'auto' }} />
      </div>
    )}

    {/*<Box sx={letterSx}>*/}
    {/*  {String.fromCharCode(65 + props.rayIndex)}*/}
    {/*</Box>*/}

    {props.llmVendorIcon && (
      <props.llmVendorIcon sx={{ fontSize: 'lg', my: 'auto' }} />
    )}

    <Box sx={{ flex: 1 }}>
      {props.llmComponent}
    </Box>

    {!props.isLlmLinked && (
      <GoodTooltip title={props.isLlmLinked ? undefined : 'Link to the Merge model'}>
        <IconButton disabled={props.isLlmLinked || props.isScattering} size='sm' onClick={props.onLink}>
          {props.isLlmLinked ? <LinkIcon /> : <LinkOffIcon />}
        </IconButton>
      </GoodTooltip>
    )}

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
  isMobile: boolean,
  isRemovable: boolean
  linkedLlmId: DLLMId | null,
  rayId: string,
}) {

  // external state
  const ray = useBeamStore(props.beamStore, (store) => store.rays.find(ray => ray.rayId === props.rayId) ?? null);
  const rayScrolling = useBeamRayScrolling();

  // derived state
  const isError = rayIsError(ray);
  const isScattering = rayIsScattering(ray);
  const isSelectable = rayIsSelectable(ray);
  const isSelected = rayIsUserSelected(ray);
  const isImported = rayIsImported(ray);
  const showUseButton = isSelectable && !isScattering;
  const { removeRay, rayToggleScattering, raySetScatterLlmId } = props.beamStore.getState();

  const isLlmLinked = !!props.linkedLlmId && !ray?.scatterLlmId;
  const llmId: DLLMId | null = isLlmLinked ? props.linkedLlmId : ray?.scatterLlmId || null;
  const setLlmId = React.useCallback((llmId: DLLMId | null) => raySetScatterLlmId(props.rayId, llmId), [props.rayId, raySetScatterLlmId]);
  const handleLlmLink = React.useCallback(() => setLlmId(null), [setLlmId]);
  const [_, llmComponent, llmVendorIcon] = useLLMSelect(llmId, setLlmId, '', true, isScattering);


  // handlers

  const handleRayCopy = React.useCallback(() => {
    const { rays, onSuccessCallback } = props.beamStore.getState();
    const ray = rays.find(ray => ray.rayId === props.rayId);
    if (ray?.message?.text && onSuccessCallback)
      copyToClipboard(ray.message.text, 'Beam');
  }, [props.beamStore, props.rayId]);

  const handleRayUse = React.useCallback(() => {
    // get snapshot values, so we don't have to react to the hook
    const { rays, onSuccessCallback } = props.beamStore.getState();
    const ray = rays.find(ray => ray.rayId === props.rayId);
    if (ray?.message?.text && onSuccessCallback)
      onSuccessCallback(ray.message.text, llmId || '');
  }, [llmId, props.beamStore, props.rayId]);

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
      // onClick={isSelectable ? handleRayToggleSelect : undefined}
      className={`${isError ? beamCardClasses.errored : ''} ${isSelectable ? beamCardClasses.selectable : ''}`}
    >

      {/* Controls Row */}
      <RayControlsMemo
        // rayIndex={props.rayIndex}
        isEmpty={!isSelectable}
        isLlmLinked={isLlmLinked}
        isRemovable={props.isRemovable}
        isScattering={isScattering}
        llmComponent={llmComponent}
        llmVendorIcon={llmVendorIcon}
        onLink={handleLlmLink}
        onRemove={handleRayRemove}
        onToggleGenerate={handleRayToggleGenerate}
      />

      {/* Show issue, if any */}
      {!!ray?.scatterIssue && <InlineError error={ray.scatterIssue} />}

      {/* Ray Message */}
      {(!!ray?.message?.text || ray?.status === 'scattering') && (
        <Box sx={{
          minHeight: '1.5rem',
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
            sx={rayScrolling ? chatMessageEmbeddedScrollingSx : chatMessageEmbeddedSx}
          />
        </Box>
      )}

      {/* Use Ray */}
      {showUseButton && (
        <Box sx={{ mt: 'auto', mb: -1, mr: -1, placeSelf: 'end', height: 'calc(2.5rem - var(--Pad_2))', position: 'relative' }}>
          <Box sx={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            display: 'flex',
            gap: 1,
          }}>
            {!isImported && (
              <GoodTooltip title='Copy'>
                <IconButton
                  size='sm'
                  onClick={handleRayCopy}
                >
                  <ContentCopyIcon sx={{ fontSize: 'md' }} />
                </IconButton>
              </GoodTooltip>
            )}
            <GoodTooltip title='Choose this message'>
              <IconButton
                size='sm'
                color='success'
                disabled={isImported || isScattering}
                onClick={handleRayUse}
                sx={{
                  fontSize: 'xs',
                  px: isImported ? 1 : undefined,
                  whiteSpace: 'nowrap',
                }}
              >
                {isImported ? 'From Chat' : /*'Use'*/ <TelegramIcon />}
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