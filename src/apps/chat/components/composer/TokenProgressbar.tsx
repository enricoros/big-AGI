import * as React from 'react';

import { Box, Tooltip, useTheme } from '@mui/joy';

import { tokensPrettyMath } from './TokenBadge';


/**
 * Progress bar, with curves to match the rounded-corners Textarea
 *
 * The Textarea contains it within the Composer (at least).
 */
export function TokenProgressbar(props: { indirect: number, direct: number, limit: number }) {
  // external state
  const theme = useTheme();

  if (!(props.limit > 0) || (!props.direct && !props.indirect)) return null;

  // compute percentages
  let indirectPct = 100 * props.indirect / props.limit;
  let totalPct = 100 * (props.indirect + props.direct) / props.limit;
  const isOverflow = totalPct >= 100;

  if (isOverflow) {
    indirectPct *= 100 / totalPct;
    totalPct = 100 * 100 / totalPct;
  }

  // bar colors
  const directColor = theme.vars.palette.primary.solidBg;
  const indirectColor = theme.vars.palette.neutral.softHoverBg;
  const overflowColor = theme.vars.palette.danger.solidBg;

  // tooltip message/color
  const { message, color } = tokensPrettyMath(props.limit, props.direct, props.indirect);

  // sizes
  const containerHeight = 8;
  const height = isOverflow ? 8 : 4;

  return (

    <Tooltip title={<span style={{ whiteSpace: 'pre' }}>{message}</span>} color={color} sx={{ fontFamily: theme.fontFamily.code }}>

      <Box sx={{
        position: 'absolute', left: 1, right: 1, bottom: 1, height: containerHeight,
        overflow: 'hidden', borderBottomLeftRadius: 7, borderBottomRightRadius: 7,
      }}>

        {/* Indirect */}
        {indirectPct > 0 && <Box sx={{
          background: indirectColor,
          position: 'absolute', left: 0, bottom: 0, width: indirectPct + '%', height,
        }} />}

        {/* Direct */}
        {totalPct > indirectPct && <Box sx={{
          background: directColor,
          position: 'absolute', left: indirectPct + '%', bottom: 0, width: (totalPct - indirectPct) + '%', height,
        }} />}

        {/* Overflow */}
        {isOverflow && <Box sx={{
          background: overflowColor,
          position: 'absolute', left: totalPct + '%', right: 0, bottom: 0, height,
        }} />}

      </Box>

    </Tooltip>
  );
}