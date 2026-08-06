import * as React from 'react';
import TimeAgo from 'react-timeago';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { llmsGetVendorIcon } from '~/modules/llms/components/LLMVendorIcon';

import type { DMessage } from '~/common/stores/chat/chat.message';
import type { Immutable } from '~/common/types/immutable.types';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { tooltipMetricsGridSx, prettyMessageMetrics, prettyShortChatModelName, prettyTokenStopReason } from '~/common/util/dMessageUtils';


const contentSx: SxProps = {
  fontSize: 'sm',
  display: 'grid',
  gap: 1.5,
};

const vendorIconContainerSx: SxProps = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
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

  const { message } = props;
  const { generator, created, updated, tokenCount, role } = message;

  const isAix = generator?.mgt === 'aix';
  const vendorId = isAix ? generator.aix?.vId ?? null : null;
  const VendorIcon = vendorId ? llmsGetVendorIcon(vendorId) : null;
  const metrics = generator?.metrics ? prettyMessageMetrics(generator.metrics, 'extra') : null;
  const stopReason = generator?.tokenStopReason ? prettyTokenStopReason(generator.tokenStopReason, 'extra') : null;

  return (
    <GoodModal
      open={props.open}
      onClose={props.onClose}
      title='Message Info'
      hideBottomClose
      sx={{ minWidth: { xs: 300, sm: 400 }, maxWidth: 480 }}
    >
      <Box sx={contentSx}>

        {/* Model / Generator */}
        {generator && (
          <Box sx={tooltipMetricsGridSx}>
            <div>Model:</div>
            <div>
              {VendorIcon
                ? <Box sx={vendorIconContainerSx}><VendorIcon />{prettyShortChatModelName(generator.name)}</Box>
                : prettyShortChatModelName(generator.name)}
            </div>
            {isAix && generator.aix?.mId && <>
              <div>ID:</div>
              <div style={{ opacity: 0.75 }}>{generator.aix.mId}</div>
            </>}
            {generator.providerInfraLabel && <>
              <div>Provider:</div>
              <div>{generator.providerInfraLabel}</div>
            </>}
            {stopReason && <>
              <div>Status:</div>
              <div>{stopReason}</div>
            </>}
          </Box>
        )}

        {/* Metrics (tokens, speed, cost, time) */}
        {metrics}

        {/* Message metadata */}
        <Box sx={tooltipMetricsGridSx}>
          <div>Role:</div>
          <div>{role}</div>
          {tokenCount > 0 && <>
            <div>Tokens:</div>
            <div>{tokenCount.toLocaleString()} (visible text ~approx)</div>
          </>}
        </Box>

        {/* Timestamps */}
        <Box sx={timestampSx}>
          {!!created && <div>Created <TimeAgo date={created} /> - {new Date(created).toLocaleString()}</div>}
          {!!updated && <div>Updated <TimeAgo date={updated} /> - {new Date(updated).toLocaleString()}</div>}
        </Box>

      </Box>
    </GoodModal>
  );
}
