import * as React from 'react';

import { Box, Button, IconButton, Tooltip, Typography } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import WebIcon from '@mui/icons-material/Web';

import { HtmlBlock } from './blocks';


const IFrameComponent = (props: { htmlString: string }) => {
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

  return (
    <Box
      sx={{
        position: 'relative', mx: 0, p: 1.5, // this block gets a thicker border
        minWidth: { xs: '300px', md: '750px', lg: '900px', xl: '1100px' },
        '&:hover > .code-buttons': { opacity: 1 },
        ...sx,
      }}>

      {/* Buttons */}
      <Box
        className='code-buttons'
        sx={{
          position: 'absolute', top: 0, right: 0, zIndex: 10, mr: 7,
          display: 'flex', flexDirection: 'row', gap: 1,
          opacity: 0, transition: 'opacity 0.3s',
        }}>
        <Tooltip title={showHTML ? 'Hide' : 'Show Web Page'} variant='solid'>
          <IconButton variant={showHTML ? 'solid' : 'soft'} color='danger' onClick={() => setShowHTML(!showHTML)}>
            <WebIcon />
          </IconButton>
        </Tooltip>
      </Box>

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
    </Box>
  );
}