import * as React from 'react';

import { Badge, Box, ColorPaletteProp, Tooltip } from '@mui/joy';


function alignRight(value: number, columnSize: number = 7) {
  const str = value.toLocaleString();
  return str.padStart(columnSize);
}


export function tokensPrettyMath(tokenLimit: number | 0, directTokens: number, historyTokens?: number, responseMaxTokens?: number): {
  color: ColorPaletteProp, message: string, remainingTokens: number
} {
  const usedTokens = directTokens + (historyTokens || 0) + (responseMaxTokens || 0);
  const remainingTokens = tokenLimit - usedTokens;
  const gteLimit = (remainingTokens <= 0 && tokenLimit > 0);

  // message
  let message: string = gteLimit ? '⚠️ ' : '';

  // no limit: show used tokens only
  if (!tokenLimit) {
    message += `Requested: ${usedTokens.toLocaleString()} tokens`;
  }
  // has full information (d + i < l)
  else if (historyTokens || responseMaxTokens) {
    message +=
      `${Math.abs(remainingTokens).toLocaleString()} ${remainingTokens >= 0 ? 'available' : 'excess'} message tokens\n\n` +
      ` = Model max tokens: ${alignRight(tokenLimit)}\n` +
      `     - This message: ${alignRight(directTokens)}\n` +
      `          - History: ${alignRight(historyTokens || 0)}\n` +
      `     - Max response: ${alignRight(responseMaxTokens || 0)}`;
  }
  // Cleaner mode: d + ? < R (total is the remaining in this case)
  else {
    message +=
      `${(tokenLimit + usedTokens).toLocaleString()} available tokens after deleting this\n\n` +
      ` = Currently free: ${alignRight(tokenLimit)}\n` +
      `   + This message: ${alignRight(usedTokens)}`;
  }

  const color: ColorPaletteProp =
    (tokenLimit && remainingTokens < 0)
      ? 'danger'
      : remainingTokens < tokenLimit / 4
        ? 'warning'
        : 'primary';

  return { color, message, remainingTokens };
}


export const TokenTooltip = (props: { message: string | null, color: ColorPaletteProp, placement?: 'top' | 'top-end', children: React.JSX.Element }) =>
  <Tooltip
    placement={props.placement}
    variant={props.color !== 'primary' ? 'solid' : 'soft'} color={props.color}
    title={props.message
      ? <Box sx={{ p: 2, whiteSpace: 'pre' }}>
        {props.message}
      </Box>
      : null
    }
    sx={{
      fontFamily: 'code',
      boxShadow: 'xl',
    }}
  >
    {props.children}
  </Tooltip>;


/**
 * Simple little component to show the token count (and a tooltip on hover)
 */
export const TokenBadgeMemo = React.memo(TokenBadge);

function TokenBadge(props: {
  direct: number, history?: number, responseMax?: number, limit: number,
  showExcess?: boolean, absoluteBottomRight?: boolean, inline?: boolean,
}) {

  const { message, color, remainingTokens } = tokensPrettyMath(props.limit, props.direct, props.history, props.responseMax);

  // show the direct tokens, unless we exceed the limit and 'showExcess' is enabled
  const value = (props.showExcess && (props.limit && remainingTokens <= 0))
    ? Math.abs(remainingTokens)
    : props.direct;

  return (
    <Badge
      variant='solid' color={color} max={100000}
      invisible={!props.direct && remainingTokens >= 0}
      badgeContent={
        <TokenTooltip color={color} message={message}>
          <span>{value.toLocaleString()}</span>
        </TokenTooltip>
      }
      sx={{
        ...((props.absoluteBottomRight) && { position: 'absolute', bottom: 8, right: 8 }),
        cursor: 'help',
      }}
      slotProps={{
        badge: {
          sx: {
            fontFamily: 'code',
            ...((props.absoluteBottomRight || props.inline) && { position: 'static', transform: 'none' }),
          },
        },
      }}
    />
  );
}