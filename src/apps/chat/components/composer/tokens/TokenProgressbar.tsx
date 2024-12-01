import * as React from 'react';

import { Box, useTheme } from '@mui/joy';

import type { DPricingChatGenerate } from '~/common/stores/llms/llms.pricing';

import { tokenCountsMathAndMessage, TokenTooltip } from './TokenTooltip';


/**
 * Progress bar, with curves to match the rounded-corners Textarea
 *
 * The Textarea contains it within the Composer (at least).
 */
export const TokenProgressbarMemo = React.memo(TokenProgressbar);

function TokenProgressbar(props: {
  chatPricing?: DPricingChatGenerate,

  direct: number,
  history: number,
  responseMax: number,
  limit: number,
}) {

  // external state
  const theme = useTheme();

  if (!(props.limit > 0) || (!props.direct && !props.history && !props.responseMax)) return null;

  // compute percentages
  let historyPct = 100 * props.history / props.limit;
  let responsePct = 100 * props.responseMax / props.limit;
  let directPct = 100 * props.direct / props.limit;
  const totalPct = historyPct + responsePct + directPct;
  const isOverflow = totalPct >= 100;

  if (isOverflow) {
    let scale = 100 / totalPct;
    scale *= scale; // make proportional space for the 'danger' (overflow) representation
    historyPct *= scale;
    responsePct *= scale;
    directPct *= scale;
  }

  // bar colors
  const historyColor = theme.palette.primary.softActiveBg;
  const directColor = theme.palette.primary.solidBg;
  const responseColor = theme.palette.neutral.softActiveBg;
  const overflowColor = theme.palette.danger.softColor;

  // tooltip message/color
  const { message, color } = tokenCountsMathAndMessage(props.limit, props.direct, props.history, props.responseMax, props.chatPricing);

  // sizes
  const containerHeight = 8;
  const height = isOverflow ? 8 : 4;

  return (

    <TokenTooltip color={color} message={props.direct ? null : message}>

      <Box sx={{
        position: 'absolute', left: 1, right: 1, bottom: 1, height: containerHeight,
        overflow: 'hidden', borderBottomLeftRadius: 5, borderBottomRightRadius: 5,
      }}>

        {/* History */}
        {historyPct > 0 && <Box sx={{
          background: historyColor,
          position: 'absolute', left: 0, bottom: 0, width: historyPct + '%', height,
        }} />}

        {/* Direct */}
        {directPct > 0 && <Box sx={{
          background: directColor,
          position: 'absolute', left: historyPct + '%', bottom: 0, width: directPct + '%', height,
        }} />}

        {/* Response */}
        {responsePct > 0 && <Box sx={{
          background: responseColor,
          position: 'absolute', left: (totalPct > 100 ? (historyPct + directPct) : (100 - responsePct)) + '%', bottom: 0, width: responsePct + '%', height,
        }} />}

        {/* Overflow */}
        {isOverflow && <Box sx={{
          background: overflowColor,
          position: 'absolute', left: (historyPct + directPct + responsePct) + '%', right: 0, bottom: 0, height,
        }} />}

      </Box>

    </TokenTooltip>
  );
}