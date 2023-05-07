import * as React from 'react';

import { Badge, ColorPaletteProp, Tooltip, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';


export function tokensPrettyMath(tokenLimit: number | 0, directTokens: number, indirectTokens?: number): { message: string, color: ColorPaletteProp } {
  const usedTokens = directTokens + (indirectTokens || 0);
  const remainingTokens = tokenLimit - usedTokens;
  let message: string = (tokenLimit && remainingTokens < 0) ? '⚠️ ' : '';
  if (!tokenLimit) {
    message += `Requested: ${usedTokens.toLocaleString()} tokens`;
  } else if (indirectTokens) {
    message += `${remainingTokens.toLocaleString()} available tokens\n\n= Model capacity: ${tokenLimit.toLocaleString()}\n- Request: ${usedTokens.toLocaleString()} tokens`;
    message += ` (Chat: ${directTokens.toLocaleString()}${indirectTokens ? ', History + Response: ' + indirectTokens?.toLocaleString() : ''})`;
  } else
    message += `${(tokenLimit + usedTokens).toLocaleString()} available tokens = Currently free: ${tokenLimit.toLocaleString()} + This message: ${usedTokens.toLocaleString()} tokens`;
  const color: ColorPaletteProp = (tokenLimit && remainingTokens < 1) ? 'danger' : remainingTokens < tokenLimit / 4 ? 'warning' : 'primary';
  return { message, color };
}


/**
 * Simple little component to show the token count (and a tooltip on hover)
 */
export function TokenBadge({ directTokens, indirectTokens, tokenLimit, absoluteBottomRight, inline, sx }: { directTokens: number, indirectTokens?: number, tokenLimit: number, absoluteBottomRight?: boolean, inline?: boolean, sx?: SxProps }) {

  // external state
  const theme = useTheme();

  const fontSx: SxProps = { fontFamily: theme.fontFamily.code, ...(sx || {}) };
  const outerSx: SxProps = absoluteBottomRight ? { position: 'absolute', bottom: 8, right: 8 } : {};
  const innerSx: SxProps = (absoluteBottomRight || inline) ? { position: 'static', transform: 'none', ...fontSx } : fontSx;

  const { message, color } = tokensPrettyMath(tokenLimit, directTokens, indirectTokens);

  const badgeContent = directTokens > 0
    ? <Tooltip title={<span style={{ whiteSpace: 'pre' }}>{message}</span>} color={color} sx={fontSx}><span>{directTokens.toLocaleString()}</span></Tooltip>
    : null;

  return (
    <Badge
      size='md' variant='solid' max={65535} showZero={false}
      color={color} badgeContent={badgeContent}
      sx={outerSx}
      slotProps={{ badge: { sx: innerSx } }}
    />
  );
}