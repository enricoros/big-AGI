import * as React from 'react';

import { Badge, Tooltip, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';


/**
 * Simple little component to show the token count (and a tooltip on hover)
 */
export function TokenBadge({ directTokens, indirectTokens, tokenLimit, absoluteBottomRight }: { directTokens: number, indirectTokens?: number, tokenLimit: number, absoluteBottomRight?: boolean }) {

  // external state
  const theme = useTheme();

  // derived state
  const usedTokens = directTokens + (indirectTokens || 0);
  const remainingTokens = tokenLimit - usedTokens;

  let message: string = remainingTokens < 0 ? '⚠️ ' : '';
  if (indirectTokens) {
    message += `${remainingTokens.toLocaleString()} remaining tokens · Model capacity: ${tokenLimit.toLocaleString()} - Request: ${usedTokens.toLocaleString()} tokens`;
    message += ` (Chat: ${directTokens.toLocaleString()}${indirectTokens ? ', History & Response: ' + indirectTokens?.toLocaleString() + ')' : ''})`;
  } else
    message += `${remainingTokens.toLocaleString()} remaining tokens · Allowed: ${tokenLimit.toLocaleString()} - Requested: ${usedTokens.toLocaleString()} tokens`;
  const color = remainingTokens < 1 ? 'danger' : remainingTokens < tokenLimit / 4 ? 'warning' : 'primary';

  const fontSx: SxProps = { fontFamily: theme.fontFamily.code };
  const outerSx: SxProps = absoluteBottomRight ? { position: 'absolute', bottom: 8, right: 8 } : {};
  const innerSx: SxProps = absoluteBottomRight ? { position: 'static', transform: 'none', ...fontSx } : fontSx;

  const badgeContent = directTokens > 0
    ? <Tooltip title={message} color={color} sx={fontSx}><span>{directTokens.toLocaleString()}</span></Tooltip>
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