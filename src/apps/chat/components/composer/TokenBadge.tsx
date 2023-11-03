import * as React from 'react';

import { Badge, ColorPaletteProp, Tooltip } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';


export function tokensPrettyMath(tokenLimit: number | 0, directTokens: number, indirectTokens?: number) {
  const usedTokens = directTokens + (indirectTokens || 0);
  const remainingTokens = tokenLimit - usedTokens;
  const gteLimit = (remainingTokens <= 0 && tokenLimit > 0);

  // message
  let message: string = gteLimit ? '⚠️ ' : '';

  // no limit: show used tokens only
  if (!tokenLimit) {
    message += `Requested: ${usedTokens.toLocaleString()} tokens`;
  }
  // has full information (d + i < l)
  else if (indirectTokens) {
    message +=
      `${Math.abs(remainingTokens).toLocaleString()} ${remainingTokens > 0 ? 'available' : 'excess'} tokens\n\n` +
      `  = Model max tokens:  ${tokenLimit.toLocaleString()}\n` +
      `      - Chat Message:  ${directTokens.toLocaleString()}` +
      (indirectTokens ? `\n- History + Response:  ${indirectTokens?.toLocaleString()}` : '');
  }
  // Cleaner mode: d + ? < R (total is the remaining in this case)
  else {
    message +=
      `${(tokenLimit + usedTokens).toLocaleString()} available tokens after deleting this\n\n` +
      ` = Currently free: ${tokenLimit.toLocaleString()}\n` +
      `   + This message: ${usedTokens.toLocaleString()}`;
  }

  const color: ColorPaletteProp =
    (tokenLimit && remainingTokens < 1)
      ? 'danger'
      : remainingTokens < tokenLimit / 4
        ? 'warning'
        : 'primary';

  return { color, message, remainingTokens };
}


/**
 * Simple little component to show the token count (and a tooltip on hover)
 */
export function TokenBadge({ directTokens, indirectTokens, tokenLimit, showExcess, absoluteBottomRight, inline, sx }: { directTokens: number, indirectTokens?: number, tokenLimit: number, showExcess?: boolean, absoluteBottomRight?: boolean, inline?: boolean, sx?: SxProps }) {

  const fontSx: SxProps = { fontFamily: 'code', ...(sx || {}) };
  const outerSx: SxProps = absoluteBottomRight ? { position: 'absolute', bottom: 8, right: 8 } : {};
  const innerSx: SxProps = (absoluteBottomRight || inline) ? { position: 'static', transform: 'none', ...fontSx } : fontSx;

  const { message, color, remainingTokens } = tokensPrettyMath(tokenLimit, directTokens, indirectTokens);

  // show the direct tokens, unless we exceed the limit and 'showExcess' is enabled
  const value = (showExcess && (tokenLimit && remainingTokens <= 0))
    ? Math.abs(remainingTokens)
    : directTokens;

  return (
    <Badge
      variant='solid' color={color} max={100000}
      invisible={!directTokens && remainingTokens >= 0}
      badgeContent={
        <Tooltip title={<span style={{ whiteSpace: 'pre' }}>{message}</span>} color={color} sx={fontSx}>
          <span>{value.toLocaleString()}</span>
        </Tooltip>
      }
      sx={outerSx}
      slotProps={{
        badge: {
          sx: innerSx,
        },
      }}
    />
  );
}