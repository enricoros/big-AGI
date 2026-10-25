import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { renderSVGToPNGBlob } from '~/common/util/imageUtils';
import { sanitizeSvgMarkup } from '~/common/util/svgSanitizeUtils';

import type { IRenderHandle } from './IRenderHandle';


function _removePotentialComments(code: string): string {
  return code.replace(/^(<!--[^>]*-->)+\s*/i, '');
}

/**
 * Detects whether a string contains valid SVG trimmedCode
 */
export function heuristicIsSVGCode(trimmedCode: string): boolean {

  // quick outs
  if (!trimmedCode.startsWith('<') || !trimmedCode.endsWith('</svg>')) return false;

  // strip HTML comments from the start of the trimmedCode
  const codeNoComments = trimmedCode.startsWith('<!--') ? _removePotentialComments(trimmedCode) : trimmedCode;

  // check for standard SVG patterns
  if (codeNoComments.startsWith('<svg')) return true;

  // check for XML declaration followed by SVG tag
  // NOTE: formerly we had `codeNoComments.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg')`
  const xmlDeclarationRegex = /^<\?xml\s+version\s*=\s*"1\.0"\s+encoding\s*=\s*"UTF-8"\s*\?>[\s\S]*?<svg/i;
  if (xmlDeclarationRegex.test(codeNoComments)) return true;

  // no match
  return false;
}

export function useFittedSvgString(svgCode: string | null, fitContainer: boolean): string | null {
  return React.useMemo(() => {
    if (!svgCode) return null;
    return !fitContainer ? svgCode
      : svgCode.replace('<svg ', `<svg style="width: 100%; height: 100%; object-fit: contain" `) || null;
  }, [fitContainer, svgCode]);
}


const svgSx: SxProps = {
  lineHeight: 0,
};


export const RenderCodeSVG = React.forwardRef(function RenderCodeSVG(props: {
  svgCode: string;
  fitScreen: boolean;
}, ref: React.Ref<IRenderHandle>) {

  // state - code blocks are untrusted (LLM output, shared chats), sanitize before DOM injection
  const safeSvgCode = React.useMemo(() => sanitizeSvgMarkup(props.svgCode) || null, [props.svgCode]);
  const patchedSvgCode = useFittedSvgString(safeSvgCode, props.fitScreen);


  // Expose control methods
  React.useImperativeHandle(ref, () => ({
    renderAsPNGBlob: async (transparentBackground: boolean) => {
      if (!patchedSvgCode) return null;
      const blob = await renderSVGToPNGBlob(patchedSvgCode, transparentBackground, 2);
      return !blob ? null : { blob, prefix: 'svg' };
    },
  }), [patchedSvgCode]);


  return (
    <Box
      component='div'
      className='code-container'
      dangerouslySetInnerHTML={{ __html: patchedSvgCode || 'No SVG code' }}
      sx={svgSx}
    />
  );
});
