import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Tooltip, Typography } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WebIcon from '@mui/icons-material/Web';

import { copyToClipboard } from '~/common/util/clipboardUtils';

import type { HtmlBlock } from './blocks';
import { OverlayButton, overlayButtonsSx } from './code/RenderCode';


// this is used by the blocks parser (for full text detection) and by the Code component (for inline rendering)
export function heuristicIsHtml(text: string): boolean {
  // noinspection HtmlRequiredTitleElement
  return text.startsWith('<!DOCTYPE html') || text.startsWith('<head>\n');
}


export const IFrameComponent = (props: { htmlString: string }) => {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    if (iframeRef.current) {
      const iframeDoc = iframeRef.current.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(props.htmlString);
        iframeDoc.close();
      }
    }
  }, [props.htmlString]);

  return (
    <iframe
      ref={iframeRef}
      style={{
        flexGrow: 1,
        width: '100%',
        height: '50svh',
        border: 'none',
        boxSizing: 'border-box',
      }}
      title='HTML content'
    />
  );
};


export function RenderHtml(props: { htmlBlock: HtmlBlock, sx?: SxProps }) {
  const [showHTML, setShowHTML] = React.useState(false);

  // remove the font* properties from sx
  const sx: any = props.sx || {};
  for (const key in sx)
    if (key.startsWith('font'))
      delete sx[key];

  const handleCopyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(props.htmlBlock.html, 'HTML');
  };

  return (
    <Box sx={{ position: 'relative' /* for overlay buttons to stick properly */ }}>
      <Box
        sx={{
          minWidth: { sm: '480px', md: '750px', lg: '950px', xl: '1200px' },
          mx: 0, p: 1.5, // this block gets a thicker border
          display: 'block',
          overflowX: 'auto',
          '&:hover > .overlay-buttons': { opacity: 1 },
          ...sx,
        }}
      >

        {/* Highlighted Code / SVG render */}
        {showHTML
          ? <IFrameComponent htmlString={props.htmlBlock.html} />
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
                Show Web Page
              </Button>
            </Box>
          </Box>
        }

        {/* External HTML Buttons */}
        <Box className='overlay-buttons' sx={{ ...overlayButtonsSx, p: 1.5 }}>
          <Tooltip title={showHTML ? 'Hide' : 'Show Web Page'} variant='solid'>
            <OverlayButton variant={showHTML ? 'solid' : 'outlined'} color='danger' onClick={() => setShowHTML(!showHTML)}>
              <WebIcon />
            </OverlayButton>
          </Tooltip>
          <Tooltip title='Copy Code' variant='solid'>
            <OverlayButton variant='outlined' onClick={handleCopyToClipboard}>
              <ContentCopyIcon />
            </OverlayButton>
          </Tooltip>
        </Box>

      </Box>
    </Box>
  );
}