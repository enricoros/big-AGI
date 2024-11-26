import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';


function _removePotentialComments(code: string): string {
  return code.replace(/^(<!--[^>]*-->)*\s*/i, '');
}

/**
 * Detects whether a string contains valid SVG trimmedCode
 */
export function heuristicIsSVGCode(trimmedCode: string): boolean {

  // quick outs
  if (!trimmedCode.startsWith('<') || !trimmedCode.endsWith('</svg>')) return false;

  // strip HTML comments from the start of the trimmedCode
  const codeWithoutInitialComments = trimmedCode.startsWith('<!--') ? _removePotentialComments(trimmedCode) : trimmedCode;

  // check for standard SVG patterns
  return codeWithoutInitialComments.startsWith('<svg') || codeWithoutInitialComments.startsWith('<?xml version="1.0" encoding="UTF-8"?>\\n<svg');
}


export function patchSvgString(fitScreen: boolean, svgCode?: string | null): string | null {
  return fitScreen ? svgCode?.replace('<svg ', `<svg style="width: 100%; height: 100%; object-fit: contain" `) || null : svgCode || null;
}


const svgSx: SxProps = {
  lineHeight: 0,
};

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
      sx={svgSx}
    />
  );
}
