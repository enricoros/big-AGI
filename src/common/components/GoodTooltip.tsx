import * as React from 'react';

import { Tooltip } from '@mui/joy';


/**
 * Tooltip with text that wraps to multiple lines (doesn't go too long)
 */
export const GoodTooltip = (props: { title: string | React.JSX.Element, children: React.JSX.Element }) =>
  <Tooltip title={props.title} sx={{ maxWidth: { sm: '50vw', md: '25vw' } }}>
    {props.children}
  </Tooltip>;
