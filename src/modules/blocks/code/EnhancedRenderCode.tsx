import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { RenderCodeMemo } from './RenderCode';


export function EnhancedRenderCode(props: {
  semiStableId: string | undefined,
  title: string,
  code: string,
  isPartial: boolean,
  fitScreen?: boolean,
  initialShowHTML?: boolean,
  noCopyButton?: boolean,
  optimizeLightweight?: boolean,
  sx?: SxProps,
}) {
  return (
    <Box>

      {/*<Box>*/}
      {/*  TODO */}
      {/*</Box>*/}

      <RenderCodeMemo
        semiStableId={props.semiStableId}
        code={props.code}
        title={props.title}
        isPartial={props.isPartial}
        fitScreen={props.fitScreen}
        initialShowHTML={props.initialShowHTML}
        noCopyButton={props.noCopyButton}
        optimizeLightweight={props.optimizeLightweight}
        sx={props.sx}
      />

    </Box>
  );
}