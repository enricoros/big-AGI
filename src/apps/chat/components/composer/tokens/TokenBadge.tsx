import * as React from 'react';

import { Badge } from '@mui/joy';

import type { DChatGeneratePricing } from '~/common/stores/llms/llms.pricing';
import { formatModelsCost } from '~/common/util/costUtils';

import { tokenCountsMathAndMessage, TokenTooltip } from './TokenTooltip';


/**
 * Simple little component to show the token count (and a tooltip on hover)
 */
export const TokenBadgeMemo = React.memo(TokenBadge);

function TokenBadge(props: {
  chatPricing?: DChatGeneratePricing,

  direct: number,
  history?: number,
  responseMax?: number,
  limit: number,

  enableHover?: boolean,
  showCost?: boolean
  showExcess?: boolean,
  absoluteBottomRight?: boolean,
  inline?: boolean,
}) {

  // state
  const [isHovering, setIsHovering] = React.useState(false);

  const { message, color, remainingTokens, costMax, costMin } =
    tokenCountsMathAndMessage(props.limit, props.direct, props.history, props.responseMax, props.chatPricing);


  // handlers
  const handleHoverEnter = React.useCallback(() => setIsHovering(true), []);

  const handleHoverLeave = React.useCallback(() => setIsHovering(false), []);


  let badgeValue: string;

  const showAltCosts = !!props.showCost && !!costMax && costMin !== undefined;
  if (showAltCosts) {
    // Note: switched to 'min cost (>= ...)' on mobile as well, to restore the former behavior, just uncomment the !props.enableHover (a proxy for isMobile)
    badgeValue = (/*!props.enableHover ||*/ isHovering)
      ? '< ' + formatModelsCost(costMax)
      : '> ' + formatModelsCost(costMin);
  } else {

    // show the direct tokens, unless we exceed the limit and 'showExcess' is enabled
    const value = (props.showExcess && (props.limit && remainingTokens <= 0))
      ? Math.abs(remainingTokens)
      : props.direct;

    badgeValue = value.toLocaleString();
  }

  const shallHide = !props.direct && remainingTokens >= 0 && !showAltCosts;
  if (shallHide) return null;

  return (
    <TokenTooltip color={color} message={message} placement='top-end'>
      <Badge
        variant='soft' color={color} max={1000000}
        // invisible={shallHide}
        onMouseEnter={props.enableHover ? handleHoverEnter : undefined}
        onMouseLeave={props.enableHover ? handleHoverLeave : undefined}
        badgeContent={badgeValue}
        slotProps={{
          root: {
            sx: {
              ...((props.absoluteBottomRight) && { position: 'absolute', bottom: 8, right: 8 }),
              cursor: 'help',
            },
          },
          badge: {
            sx: {
              // the badge (not the tooltip)
              // boxShadow: 'sm',
              fontFamily: 'code',
              fontSize: 'xs',
              ...((props.absoluteBottomRight || props.inline) && { position: 'static', transform: 'none' }),
            },
          },
        }}
      />
    </TokenTooltip>
  );
}