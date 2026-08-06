import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, BoxProps, styled } from '@mui/joy';


/**
 * Everything in this has been hand tuned to verify that it sticks to the top, clips to the parent
 * which is the really the one whose height is following the 0..1-fr proportion.
 *
 * An alternative former implementation with just overflow: 'hidden' on the BoxCollapsee had the content
 * lagging its reveal compared to the parent.
 *
 * Another alternative had contain: 'layout paint' and no overflow property, but had a seldom 1px paint
 * issue on Chrome on the bottom edge.
 *
 * Note that the issue of 'BoxCollapsee' having a different height than the FR implies remains, but we
 * basically just use the Collapsee to ignore the layout and clip all on the parent instead.
 */
const BoxCollapser = styled(Box)({
  display: 'grid',
  alignItems: 'start',
  gridTemplateRows: '1fr',
  '&[aria-hidden="true"]': {
    gridTemplateRows: '0fr',
  },
  transition: 'grid-template-rows 0.2s cubic-bezier(.17,.84,.44,1)', // quartic - hand tuned, feels faster
  overflow: 'clip',
  contain: 'layout',
});

// Fix for RenderCode losing fixed OverlayButtons positioning system: drops the `contain` which would create a
// containing block for fixed-positioned descendants and trap things like position:fixed sticky overlays inside this collapser).
// `overflow: clip` alone keeps the collapse animation clipping without the trap.
const collapserNoContainSx = {
  contain: 'none',
} as const satisfies SxProps;

const BoxCollapsee = styled(Box)({
  /**
   * FIX: the absence of this made the ChatPanelModelParameters content overflow on the horizontal
   */
  minWidth: 0,
  minHeight: 0,
});


export function ExpanderControlledBox({ expanded, noContain, children, ...rest }: BoxProps & { expanded: boolean, noContain?: boolean, sx?: never }) {
  return (
    <BoxCollapser aria-hidden={!expanded ? true : undefined} data-agi-no-copy={!expanded || undefined} {...rest} sx={noContain ? collapserNoContainSx : undefined}>
      <BoxCollapsee>
        {children}
      </BoxCollapsee>
    </BoxCollapser>
  );
}