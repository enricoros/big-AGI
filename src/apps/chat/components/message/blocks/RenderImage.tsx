import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, IconButton, Tooltip, Typography } from '@mui/joy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReplayIcon from '@mui/icons-material/Replay';

import { Link } from '~/common/components/Link';

import type { ImageBlock } from './blocks';
import { overlayButtonsSx } from './code/RenderCode';


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
  const { url, alt } = props.imageBlock;
  const imageUrls = url.split('\n');

  return imageUrls.map((url, index) => {

    // display a notice for temporary images DallE
    const isTempDalleUrl = url.startsWith('https://oaidalle');

    return <Box
      key={'gen-img-' + index}
      sx={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative',
        mx: 1.5, mb: 1.5, // mt: (index > 0 || !props.isFirst) ? 1.5 : 0,
        // p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1,
        minWidth: 128, minHeight: 128,
        boxShadow: 'md',
        backgroundColor: 'neutral.solidBg',
        '& picture': { display: 'flex' },
        '& img': { maxWidth: '100%', maxHeight: '100%' },
        '&:hover > .overlay-buttons': { opacity: 1 },
        ...props.sx,
      }}
    >

      {/* External Image */}
      {alt ? (
        <Tooltip
          variant='outlined' color='neutral'
          placement='top'
          title={props.noTooltip ? null :
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {isTempDalleUrl && <Alert variant='soft' color='warning' sx={{ flexDirection: 'column', alignItems: 'start' }}>
                <Typography level='title-sm'>⚠️ <b>Temporary Image</b> - This image will be deleted from the OpenAI servers in one hour. <b>Please save it to your device</b>.</Typography>
                {/*<Typography level='body-xs'>*/}
                {/*  The following is the re-written DALL·E prompt that generated this image.*/}
                {/*</Typography>*/}
              </Alert>}
              <Typography level='title-sm' sx={{ p: 1 }}>
                {alt}
              </Typography>
            </Box>
          }
          sx={{
            maxWidth: { sm: '90vw', md: '70vw' },
            boxShadow: 'md',
          }}
        >
          <picture><img src={url} alt={`Generated Image: ${alt}`} /></picture>
        </Tooltip>
      ) : (
        <picture><img src={url} alt='Generated Image' /></picture>
      )}

      {/* Image Buttons */}
      <Box className='overlay-buttons' sx={{ ...overlayButtonsSx, pt: 0.5, px: 0.5, gap: 0.5 }}>
        {!!props.onRunAgain && (
          <Tooltip title='Draw again' variant='solid'>
            <IconButton variant='solid' onClick={props.onRunAgain}>
              <ReplayIcon />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title='Open in new tab'>
          <IconButton component={Link} href={url} download={alt || 'image'} target='_blank' variant='solid'>
            <OpenInNewIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>;
  });
};