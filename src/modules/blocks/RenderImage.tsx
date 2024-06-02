import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, IconButton, Sheet } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReplayIcon from '@mui/icons-material/Replay';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { Link } from '~/common/components/Link';

import type { ImageBlock } from './blocks';
import { OverlayButton, overlayButtonsSx } from './code/RenderCode';


const mdImageReferenceRegex = /^!\[([^\]]*)]\(([^)]+)\)$/;
const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|svg)/i;


/**
 * Checks if the entire content consists solely of Markdown image references.
 * If so, returns an array of ImageBlock objects for each image reference.
 * If any non-image content is present or if there are no image references, returns null.
 */
export function heuristicMarkdownImageReferenceBlocks(fullText: string) {

  // Check if all lines are valid Markdown image references with image URLs
  const imageBlocks: ImageBlock[] = [];
  for (const line of fullText.split('\n')) {
    if (line.trim() === '') continue; // skip empty lines
    const match = mdImageReferenceRegex.exec(line);
    if (match && imageExtensions.test(match[2])) {
      const alt = match[1];
      const url = match[2];
      imageBlocks.push({ type: 'image', url, alt });
    } else {
      // if there is any outlier line, return null
      return null;
    }
  }

  // Return the image blocks if all lines are image references with valid image URLs
  return imageBlocks.length > 0 ? imageBlocks : null;
}

const prodiaUrlRegex = /^(https?:\/\/images\.prodia\.\S+)$/i;

/**
 * Legacy heuristic for detecting images from "images.prodia." URLs.
 */
export function heuristicLegacyImageBlocks(fullText: string): ImageBlock[] | null {

  // Check if all lines are URLs starting with "http://images.prodia." or "https://images.prodia."
  const imageBlocks: ImageBlock[] = [];
  for (const line of fullText.split('\n')) {
    const match = prodiaUrlRegex.exec(line);
    if (match) {
      const url = match[1];
      imageBlocks.push({ type: 'image', url });
    } else {
      // if there is any outlier line, return null
      return null;
    }
  }

  // Return the image blocks if all lines are URLs from "images.prodia."
  return imageBlocks.length > 0 ? imageBlocks : null;
}


export const RenderImage = (props: {
  imageBlock: ImageBlock,
  noTooltip?: boolean,
  onRunAgain?: (e: React.MouseEvent) => void, sx?: SxProps,
}) => {

  // state
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [showAlert, setShowAlert] = React.useState(true);


  // derived state
  const { url, alt } = props.imageBlock;
  const isTempDalleUrl = url.startsWith('https://oaidalle');


  return (
    <Box sx={{}}>

      <Sheet
        variant='solid'
        sx={{
          // style
          mx: 1.5,
          minWidth: 256,
          minHeight: 128,
          boxShadow: 'md',

          // layout
          position: 'relative',
          display: 'grid',
          justifyContent: 'center',
          alignItems: 'center',

          '& picture': { display: 'flex' },
          '& img': { maxWidth: '100%', maxHeight: '100%' },
          '&:hover > .overlay-buttons': { opacity: 1 },

          ...props.sx,
        }}
      >

        {/* External Image */}
        <picture>
          <img src={url} alt={alt ? `Generated Image: ${alt}` : 'Generated Image'} />
        </picture>

        {/* Information */}
        {!!alt && infoOpen && (
          <Box sx={{ p: { xs: 1, md: 3 } }}>
            {alt}
          </Box>
        )}

        {/* (overlay) Image Buttons */}
        <Box className='overlay-buttons' sx={{ ...overlayButtonsSx, pt: 0.5, px: 0.5, gap: 0.5 }}>
          {!!props.onRunAgain && (
            <GoodTooltip title='Draw again'>
              <OverlayButton variant='outlined' onClick={props.onRunAgain}>
                <ReplayIcon />
              </OverlayButton>
            </GoodTooltip>
          )}

          {!!alt && (
            <GoodTooltip title={infoOpen ? 'Hide Prompt' : 'Show Prompt'}>
              <OverlayButton variant={infoOpen ? 'solid' : 'outlined'} onClick={() => setInfoOpen(open => !open)}>
                <InfoOutlinedIcon />
              </OverlayButton>
            </GoodTooltip>
          )}

          <GoodTooltip title='Open in new tab'>
            <OverlayButton variant='outlined' component={Link} href={url} download={alt || 'image'} target='_blank'>
              <OpenInNewIcon />
            </OverlayButton>
          </GoodTooltip>
        </Box>
      </Sheet>

      {/* Dalle Warning notice */}
      {isTempDalleUrl && showAlert && (
        <Alert
          variant='soft' color='neutral'
          startDecorator={<WarningRoundedIcon />}
          endDecorator={
            <IconButton variant='soft' aria-label='Close Alert' onClick={() => setShowAlert(on => !on)} sx={{ my: -0.5 }}>
              <CloseRoundedIcon />
            </IconButton>
          }
          sx={{
            mx: 0.5,
            ...props.sx,
          }}
        >
          <div>
            <strong>Please Save Locally</strong> · OpenAI will delete this image link from their servers one hour after creation.
          </div>
        </Alert>
      )}

    </Box>
  );
};