import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Tooltip, Typography } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WebIcon from '@mui/icons-material/Web';

import { copyToClipboard } from '~/common/util/clipboardUtils';

import type { HtmlBlock } from './blocks';
import { OverlayButton, overlayButtonsSx } from './code/RenderCode';


// this is used by the blocks parser (for full text detection) and by the Code component (for inline rendering)
export function heuristicIsBlockTextHTML(text: string): boolean {
  return ['<!DOCTYPE html', '<!doctype html', '<head'].some((start) => text.startsWith(start));
}

const simpleCssReset = `
*, *::before, *::after { box-sizing: border-box; }
body, html { margin: 0; padding: 0; }
body { min-height: 100vh; line-height: 1.5; -webkit-font-smoothing: antialiased; }
img, picture, svg, video { display: block;max-width: 100%; }
`;

function renderHtmlInIFrame(iframeDoc: Document, htmlString: string) {
  // Note: not using this for now (2024-06-15), or it would remove the JS code
  // which is what makes the HTML interactive.
  // Sanitize the HTML string to remove any potentially harmful content
  // const sanitizedHtml = DOMPurify.sanitize(props.htmlString);

  // Inject the CSS reset
  const modifiedHtml = htmlString.replace(/<style/i, `<style>${simpleCssReset}</style><style`);

  // Write the HTML to the iframe
  iframeDoc.open();
  try {
    iframeDoc.write(modifiedHtml);
  } catch (error) {
    console.error('Error writing to iframe:', error);
  }
  iframeDoc.close();

  // Enhanced Security with Content Security Policy
  // NOTE: 2024-06-15 disabled until we understand exactly all the implications
  // In theory we want script from self, images from everywhere, and styles from self
  // const meta = iframeDoc.createElement('meta');
  // meta.httpEquiv = 'Content-Security-Policy';
  // // meta.content = 'default-src \'self\'; script-src \'self\';';
  // meta.content = 'script-src \'self\' \'unsafe-inline\';';
  // iframeDoc.head.appendChild(meta);

  // Adding this event listener to prevent arrow keys from scrolling the parent page
  iframeDoc.addEventListener('keydown', (event: any) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
    }
  });
}


export const IFrameComponent = (props: { htmlString: string }) => {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  React.useEffect(() => {
    // Coalesce the rendering of the HTML content to prevent flickering and work around the React StrictMode
    const timeoutId = setTimeout(() => {
      const iframeDoc = iframeRef.current?.contentWindow?.document;
      iframeDoc && !!props.htmlString && renderHtmlInIFrame(iframeDoc, props.htmlString);
    }, 200);
    return () => clearTimeout(timeoutId);
  }, [props.htmlString]);

  return (
    <iframe
      ref={iframeRef}
      style={{
        flexGrow: 1,
        width: '100%',
        height: '54svh',
        border: 'none',
        boxSizing: 'border-box',
        maxWidth: '100%',
        maxHeight: '100%',
      }}
      title='Sandboxed Web Content'
      aria-label='Interactive content frame'
      sandbox='allow-scripts allow-same-origin allow-forms' // restrict to only these
      loading='lazy' // do not load until visible in the viewport
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
          mx: 0,
          p: 1.5, // this block gets a thicker border
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