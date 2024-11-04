import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Typography } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WebIcon from '@mui/icons-material/Web';

import { copyToClipboard } from '~/common/util/clipboardUtils';

import { OverlayButton, overlayButtonsActiveSx, overlayButtonsClassName, overlayButtonsTopRightSx } from '../OverlayButton';
import { RenderCodeHtmlIFrame } from '../code/code-renderers/RenderCodeHtmlIFrame';


// this is used by the blocks parser (for full text detection) and by the Code component (for inline rendering)
export function heuristicIsBlockPureHTML(text: string): boolean {
  return ['<!DOCTYPE html', '<!doctype html', '<head'].some((start) => text.startsWith(start));
}


export function RenderDangerousHtml(props: { html: string, sx?: SxProps }) {

  // state
  const [showHTML, setShowHTML] = React.useState(false);

  // remove the font* properties from sx
  const sx: any = props.sx || {};
  for (const key in sx)
    if (key.startsWith('font'))
      delete sx[key];

  const handleCopyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(props.html, 'HTML');
  };

  return (
    <Box sx={{ position: 'relative' /* for overlay buttons to stick properly */ }}>
      <Box
        sx={{
          minWidth: { sm: '480px', md: '750px', lg: '950px', xl: '1200px' },
          mx: 0,
          p: 1.5, // this block gets a thicker border
          display: 'block',
          overflowX: 'auto',
          [`&:hover > .${overlayButtonsClassName}`]: overlayButtonsActiveSx,
          ...sx,
        }}
      >

        {/* Highlighted Code / SVG render */}
        {showHTML
          ? <RenderCodeHtmlIFrame htmlCode={props.html} />
          : <Box>
            <Typography>
              <b>CAUTION</b> - The content you are about to access is an HTML page. It is possible that an
              unauthorized entity is monitoring this connection and has generated this content.
              Please exercise caution and do not trust the contents blindly. Be aware that proceeding
              may pose potential risks. Click the button to view the content, if you wish to proceed.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
              <Button variant='plain' color='neutral' onClick={() => setShowHTML(false)}>
                Ignore
              </Button>
              <Button variant='solid' color='danger' onClick={() => setShowHTML(true)}>
                Show HTML Page
              </Button>
            </Box>
          </Box>
        }

        {/* [overlay] Buttons (dangerous-HTML) */}
        <Box className={overlayButtonsClassName} sx={overlayButtonsTopRightSx}>

          <OverlayButton tooltip={showHTML ? 'Close HTML Page' : 'Show HTML Page'} variant={showHTML ? 'solid' : 'outlined'} color='danger' smShadow onClick={() => setShowHTML(!showHTML)}>
            <WebIcon />
          </OverlayButton>

          <OverlayButton tooltip='Copy Code' variant='outlined' smShadow onClick={handleCopyToClipboard}>
            <ContentCopyIcon />
          </OverlayButton>

        </Box>

      </Box>
    </Box>
  );
}