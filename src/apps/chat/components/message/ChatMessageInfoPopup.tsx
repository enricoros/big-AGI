import * as React from 'react';
import TimeAgo from 'react-timeago';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, Link, Typography } from '@mui/joy';

import { llmsGetVendorIcon } from '~/modules/llms/components/LLMVendorIcon';

import type { DMessage } from '~/common/stores/chat/chat.message';
import type { Immutable } from '~/common/types/immutable.types';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { PhGearSixIcon } from '~/common/components/icons/phosphor/PhGearSixIcon';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { optimaActions } from '~/common/layout/optima/useOptima';
import { tooltipMetricsGridSx, prettyMessageMetrics, prettyShortChatModelName, prettyTokenStopReason } from '~/common/util/dMessageUtils';
import { useLLMExists } from '~/common/stores/llms/llms.hooks';


const contentSx: SxProps = {
  fontSize: 'sm',
  display: 'grid',
  gap: 1.5,
};

const modelHeaderSx: SxProps = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.25,
  p: 1.25,
  minWidth: 0,
  borderRadius: 'sm',
  backgroundColor: 'background.level1',
  boxShadow: 'inset 1px 1px 4px -2px rgba(0, 0, 0, 0.2)',
};

const timestampSx: SxProps = {
  fontSize: 'xs',
  color: 'text.tertiary',
};


export function ChatMessageInfoPopup(props: {
  open: boolean,
  onClose: () => void,
  message: Immutable<DMessage>,
}) {

  const { message, onClose } = props;
  const { generator, created, updated, role } = message;

  const isAix = generator?.mgt === 'aix';
  const modelId = isAix ? generator.aix?.mId : undefined;
  const modelExists = useLLMExists(modelId);
  const vendorId = isAix ? generator.aix?.vId ?? null : null;
  const VendorIcon = vendorId ? llmsGetVendorIcon(vendorId) : null;
  const metrics = generator?.metrics ? prettyMessageMetrics(generator.metrics, 'extra') : null;
  const stopReason = generator?.tokenStopReason ? prettyTokenStopReason(generator.tokenStopReason, 'extra') : null;

  const handleOpenModelOptions = React.useCallback(() => {
    if (!modelId || !modelExists) return;
    onClose();
    optimaActions().openModelOptions(modelId, 'parameters');
  }, [modelExists, modelId, onClose]);

  return (
    <GoodModal
      open={props.open}
      onClose={onClose}
      title={`${capitalizeFirstLetter(role)} Message Info`}
      hideBottomClose
      unfilterBackdrop
      sx={{ minWidth: { xs: 300, sm: 400 }, maxWidth: 480 }}
    >
      <Box sx={contentSx}>

        {/* Model identity and settings */}
        {generator && (
          <Box sx={modelHeaderSx}>
            {VendorIcon && <VendorIcon sx={{ flexShrink: 0 }} />}
            <Box sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
              <Typography level='title-sm'>
                {modelExists ? (
                  <Link component='button' type='button' color='neutral' underline='hover' onClick={handleOpenModelOptions} sx={{ textAlign: 'left' }}>
                    {prettyShortChatModelName(generator.name)}
                  </Link>
                ) : prettyShortChatModelName(generator.name)}
              </Typography>
              {modelId && <Typography level='body-xs' sx={{ mt: 0.25 }}>{modelId}</Typography>}
            </Box>
            {modelExists && (
              <TooltipOutlined title='Model Settings'>
                <IconButton size='sm' variant='soft' color='neutral' aria-label='Model Settings' onClick={handleOpenModelOptions} sx={{ flexShrink: 0 }}>
                  <PhGearSixIcon />
                </IconButton>
              </TooltipOutlined>
            )}
          </Box>
        )}

        {/* Message metadata */}
        <Box sx={tooltipMetricsGridSx}>
          <div>Role:</div>
          <div>{role}</div>
          {/*{message.tokenCount > 0 && <>*/}
          {/*  <div>Tokens:</div>*/}
          {/*  <div>{message.tokenCount.toLocaleString()} (visible text ~approx)</div>*/}
          {/*</>}*/}
          {generator?.providerInfraLabel && <>
            <div>Provider:</div>
            <div>{generator.providerInfraLabel}</div>
          </>}
          {stopReason && <>
            <div>Status:</div>
            <div>{stopReason}</div>
          </>}
        </Box>

        {/* Metrics (tokens, speed, cost, time) */}
        {metrics}

        {/* Timestamps */}
        <Box sx={timestampSx}>
          {!!created && <div>Created <TimeAgo date={created} /> - {new Date(created).toLocaleString()}</div>}
          {!!updated && <div>Updated <TimeAgo date={updated} /> - {new Date(updated).toLocaleString()}</div>}
        </Box>

      </Box>
    </GoodModal>
  );
}
