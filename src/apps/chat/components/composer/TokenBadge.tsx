import * as React from 'react';

import { Badge, Box, ColorPaletteProp, Tooltip } from '@mui/joy';


function alignRight(value: number, columnSize: number = 8) {
  const str = value.toLocaleString();
  return str.padStart(columnSize);
}


export function tokensPrettyMath(tokenLimit: number | 0, directTokens: number, historyTokens?: number, responseMaxTokens?: number, tokenPriceIn?: number, tokenPriceOut?: number): { color: ColorPaletteProp; message: string; remainingTokens: number } {
  const usedInputTokens = directTokens + (historyTokens || 0);
  const usedMaxTokens = usedInputTokens + (responseMaxTokens || 0);
  const remainingTokens = tokenLimit - usedMaxTokens;
  const gteLimit = (remainingTokens <= 0 && tokenLimit > 0);

  // message
  let message: string = gteLimit ? '⚠️ ' : '';

  // no limit: show used tokens only
  if (!tokenLimit) {
    message += `Requested: ${usedMaxTokens.toLocaleString()} tokens`;
  }
  // has full information (d + i < l)
  else if (historyTokens || responseMaxTokens) {
    message +=
      `▶ ${Math.abs(remainingTokens).toLocaleString()} ${remainingTokens >= 0 ? 'available' : 'excess'} message tokens\n\n` +
      ` = Model max tokens: ${alignRight(tokenLimit)}\n` +
      `     - This message: ${alignRight(directTokens)}\n` +
      `          - History: ${alignRight(historyTokens || 0)}\n` +
      `     - Max response: ${alignRight(responseMaxTokens || 0)}`;

    // add the price, if available
    if (tokenPriceIn || tokenPriceOut) {
      const costIn = tokenPriceIn ? usedInputTokens * tokenPriceIn / 1E6 : undefined;
      const costOutMax = (tokenPriceOut && responseMaxTokens) ? responseMaxTokens * tokenPriceOut / 1E6 : undefined;
      if (costIn || costOutMax) {
        message += `\n\n\n▶ Chat Turn Cost (max, approximate)\n`;

        if (costIn) message += '\n' +
          `       Input tokens: ${alignRight(usedInputTokens)}\n` +
          `    Input Price $/M: ${tokenPriceIn!.toFixed(2).padStart(8)}\n` +
          `         Input cost: ${('$' + costIn!.toFixed(3)).padStart(8)}\n`;

        if (costOutMax) message += '\n' +
          `  Max output tokens: ${alignRight(responseMaxTokens!)}\n` +
          `   Output Price $/M: ${tokenPriceOut!.toFixed(2).padStart(8)}\n` +
          `    Max output cost: ${('$' + costOutMax!.toFixed(3)).padStart(8)}\n`;

        const costMax = costIn && costOutMax ? costIn + costOutMax : undefined;
        if (costMax) message += '\n' +
          `    = Max turn cost: ${('$' + costMax.toFixed(4)).padStart(8)}`;
      }
    }
  }
  // Cleaner mode: d + ? < R (total is the remaining in this case)
  else {
    message +=
      `${(tokenLimit + usedMaxTokens).toLocaleString()} available tokens after deleting this\n\n` +
      ` = Currently free: ${alignRight(tokenLimit)}\n` +
      `   + This message: ${alignRight(usedMaxTokens)}`;
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
    title={props.message ? <Box sx={{ p: 2, whiteSpace: 'pre' }}>{props.message}</Box> : null}
    sx={{
      fontFamily: 'code',
      // fontSize: '0.8125rem',
      border: '1px solid',
      borderColor: `${props.color}.outlinedColor`,
      boxShadow: 'md',
    }}
  >
    {props.children}
  </Tooltip>;


/**
 * Simple little component to show the token count (and a tooltip on hover)
 */
export const TokenBadgeMemo = React.memo(TokenBadge);

function TokenBadge(props: {
  direct: number,
  history?: number,
  responseMax?: number,
  limit: number,

  tokenPriceIn?: number,
  tokenPriceOut?: number,

  showExcess?: boolean,
  absoluteBottomRight?: boolean,
  inline?: boolean,
}) {

  const { message, color, remainingTokens } = tokensPrettyMath(props.limit, props.direct, props.history, props.responseMax, props.tokenPriceIn, props.tokenPriceOut);

  // show the direct tokens, unless we exceed the limit and 'showExcess' is enabled
  const value = (props.showExcess && (props.limit && remainingTokens <= 0))
    ? Math.abs(remainingTokens)
    : props.direct;

  return (
    <Badge
      variant='solid' color={color} max={100000}
      invisible={!props.direct && remainingTokens >= 0}
      badgeContent={
        <TokenTooltip color={color} message={message} placement='top-end'>
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
            // the badge (not the tooltip)
            fontFamily: 'code',
            fontSize: 'sm',
            ...((props.absoluteBottomRight || props.inline) && { position: 'static', transform: 'none' }),
          },
        },
      }}
    />
  );
}