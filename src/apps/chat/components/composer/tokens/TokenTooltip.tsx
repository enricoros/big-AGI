import * as React from 'react';

import { Box, ColorPaletteProp, Tooltip } from '@mui/joy';

import { adjustContentScaling, themeScalingMap } from '~/common/app.theme';
import { useUIPreferencesStore } from '~/common/state/store-ui';


export function tokenCountsMathAndMessage(tokenLimit: number | 0, directTokens: number, historyTokens?: number, responseMaxTokens?: number, tokenPriceIn?: number, tokenPriceOut?: number): {
  color: ColorPaletteProp,
  message: string,
  remainingTokens: number,
  costMax?: number,
  costMin?: number,
} {
  const usedInputTokens = directTokens + (historyTokens || 0);
  const usedMaxTokens = usedInputTokens + (responseMaxTokens || 0);
  const remainingTokens = tokenLimit - usedMaxTokens;
  const gteLimit = (remainingTokens <= 0 && tokenLimit > 0);

  // message
  let message: string = gteLimit ? '⚠️ ' : '';

  // costs
  let costMax: number | undefined = undefined;
  let costMin: number | undefined = undefined;

  // no limit: show used tokens only
  if (!tokenLimit) {
    message += `Requested: ${usedMaxTokens.toLocaleString()} tokens`;
  }
  // has full information (d + i < l)
  else if (historyTokens || responseMaxTokens) {
    message +=
      `▶ ${Math.abs(remainingTokens).toLocaleString()} ${remainingTokens >= 0 ? 'available' : 'excess'} message tokens\n\n` +
      ` = Model max tokens: ${_alignRight(tokenLimit)}\n` +
      `     - This message: ${_alignRight(directTokens)}\n` +
      `          - History: ${_alignRight(historyTokens || 0)}\n` +
      `     - Max response: ${_alignRight(responseMaxTokens || 0)}`;

    // add the price, if available
    if (tokenPriceIn || tokenPriceOut) {
      costMin = tokenPriceIn ? usedInputTokens * tokenPriceIn / 1E6 : undefined;
      const costOutMax = (tokenPriceOut && responseMaxTokens) ? responseMaxTokens * tokenPriceOut / 1E6 : undefined;
      if (costMin || costOutMax) {
        message += `\n\n\n▶ Chat Turn Cost (max, approximate)\n`;

        if (costMin) message += '\n' +
          `       Input tokens: ${_alignRight(usedInputTokens)}\n` +
          `    Input Price $/M: ${tokenPriceIn!.toFixed(2).padStart(8)}\n` +
          `         Input cost: ${('$' + costMin!.toFixed(4)).padStart(8)}\n`;

        if (costOutMax) message += '\n' +
          `  Max output tokens: ${_alignRight(responseMaxTokens!)}\n` +
          `   Output Price $/M: ${tokenPriceOut!.toFixed(2).padStart(8)}\n` +
          `    Max output cost: ${('$' + costOutMax!.toFixed(4)).padStart(8)}\n`;

        if (costMin) message += '\n' +
          `    > Min turn cost: ${formatTokenCost(costMin).padStart(8)}`;
        costMax = (costMin && costOutMax) ? costMin + costOutMax : undefined;
        if (costMax) message += '\n' +
          `    < Max turn cost: ${formatTokenCost(costMax).padStart(8)}`;
      }
    }
  }
  // Cleaner mode: d + ? < R (total is the remaining in this case)
  else {
    message +=
      `${(tokenLimit + usedMaxTokens).toLocaleString()} available tokens after deleting this\n\n` +
      ` = Currently free: ${_alignRight(tokenLimit)}\n` +
      `   + This message: ${_alignRight(usedMaxTokens)}`;
  }

  const color: ColorPaletteProp =
    (tokenLimit && remainingTokens < 0)
      ? 'danger'
      : remainingTokens < tokenLimit / 4
        ? 'warning'
        : 'primary';

  return { color, message, remainingTokens, costMax, costMin };
}

function _alignRight(value: number, columnSize: number = 8) {
  const str = value.toLocaleString();
  return str.padStart(columnSize);
}

export function formatTokenCost(cost: number) {
  return cost < 1
    ? (cost * 100).toFixed(cost < 0.010 ? 2 : 1) + ' ¢'
    : '$ ' + cost.toFixed(2);
}


export function TokenTooltip(props: { message: string | null, color: ColorPaletteProp, placement?: 'top' | 'top-end', children: React.ReactElement }) {

  // external state
  const contentScaling = useUIPreferencesStore(state => state.contentScaling);

  const fontSize = themeScalingMap[adjustContentScaling(contentScaling, -1)]?.blockFontSize ?? undefined;

  return (
    <Tooltip
      placement={props.placement}
      variant={props.color !== 'primary' ? 'solid' : 'soft'}
      color={props.color}
      title={props.message ? <Box sx={{ p: 2, whiteSpace: 'pre' }}>{props.message}</Box> : null}
      sx={{
        fontFamily: 'code',
        fontSize: fontSize,
        // fontSize: '0.8125rem',
        border: '1px solid',
        borderColor: `${props.color}.outlinedColor`,
        boxShadow: 'md',
      }}
    >
      {props.children}
    </Tooltip>
  );
}
