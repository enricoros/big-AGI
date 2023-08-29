import * as React from 'react';

import { Box, Tooltip, useTheme } from '@mui/joy';

import { tokensPrettyMath } from './TokenBadge';


/**
 * Progress bar, with curves to match the rounded-corners Textarea
 *
 * The Textarea contains it within the Composer (at least).
 */
export function TokenProgressbar(props: { history: number, response: number, direct: number, limit: number }) {
  // external state
  const theme = useTheme();

  if (!(props.limit > 0) || (!props.direct && !props.history && !props.response)) return null;

  // compute percentages
  let historyPct = 100 * props.history / props.limit;
  let responsePct = 100 * props.response / props.limit;
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
  const historyColor = theme.palette.neutral.softHoverBg;
  const directColor = theme.palette.primary.solidBg;
  const responseColor = theme.palette.neutral.softHoverBg;
  const overflowColor = theme.palette.danger.solidBg;

  // tooltip message/color
  const { message, color } = tokensPrettyMath(props.limit, props.direct, props.history + props.response);

  // sizes
  const containerHeight = 8;
  const height = isOverflow ? 8 : 4;

  return (

    <Tooltip title={<span style={{ whiteSpace: 'pre' }}>{message}</span>} color={color} sx={{ fontFamily: theme.fontFamily.code }}>

      <Box sx={{
        position: 'absolute', left: 1, right: 1, bottom: 1, height: containerHeight,
        overflow: 'hidden', borderBottomLeftRadius: 7, borderBottomRightRadius: 7,
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

    </Tooltip>
  );
}