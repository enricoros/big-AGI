import * as React from 'react';

import { Box } from '@mui/joy';


export function patchSvgString(fitScreen: boolean, svgCode?: string | null): string | null {
  return fitScreen ? svgCode?.replace('<svg ', `<svg style="width: 100%; height: 100%; object-fit: contain" `) || null : svgCode || null;
}

export function RenderCodeSVG(props: {
  svgCode: string;
  fitScreen: boolean;
}) {
  return (
    <Box
      component='div'
      className='code-container'
      dangerouslySetInnerHTML={{
        __html: patchSvgString(props.fitScreen, props.svgCode) || 'No SVG code',
      }}
      sx={{ lineHeight: 0 }}
    />
  );
}
