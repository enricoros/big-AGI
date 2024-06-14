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
      imageBlocks.push({ type: 'imageb', url, alt });
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
 * @deprecated Remove in mid 2024
 */
export function heuristicLegacyImageBlocks(fullText: string): ImageBlock[] | null {

  // Check if all lines are URLs starting with "http://images.prodia." or "https://images.prodia."
  const imageBlocks: ImageBlock[] = [];
  for (const line of fullText.split('\n')) {
    const match = prodiaUrlRegex.exec(line);
    if (match) {
      const url = match[1];
      imageBlocks.push({ type: 'imageb', url });
    } else {
      // if there is any outlier line, return null
      return null;
    }
  }

  // Return the image blocks if all lines are URLs from "images.prodia."
  return imageBlocks.length > 0 ? imageBlocks : null;
}


export const RenderImageURL = (props: {
  imageURL: string | null, // remote URL, or data URL
  description?: React.ReactNode,
  infoText?: string,
  onOpenInNewTab?: (e: React.MouseEvent) => void,
  onImageRegenerate?: () => void,
  scaledImageSx?: SxProps,
  className?: string,
}) => {

  // state
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);
  const [regenArmed, setRegenArmed] = React.useState(false);
  const [showDalleAlert, setShowDalleAlert] = React.useState(true);

  // Effect
  React.useEffect(() => {
    const timeout = setTimeout(() => setLoadingTimeout(true), 2000);
    return () => clearTimeout(timeout);
  }, []);

  // handlers
  const { onImageRegenerate, onOpenInNewTab } = props;

  const handleToggleInfoOpen = React.useCallback(() => {
    setRegenArmed(false);
    setInfoOpen(open => !open);
  }, []);

  const handleOpenInNewTab = React.useCallback((e: React.MouseEvent) => {
    setRegenArmed(false);
    onOpenInNewTab?.(e);
  }, [onOpenInNewTab]);

  const handleImageRegenerate = React.useCallback(() => {
    setRegenArmed(false);
    onImageRegenerate?.();
  }, [onImageRegenerate]);

  const handleToggleRegenArmed = React.useCallback(() => {
    setRegenArmed(armed => !armed);
  }, []);


  // derived state
  const isTempDalleUrl = props.imageURL?.startsWith('https://oaidalle') || false;


  return (
    <Box>

      <Sheet
        variant='solid'
        className={props.className}
        sx={{
          // style
          mx: 1.5,
          minWidth: 256,
          minHeight: 128,
          boxShadow: 'md',

          // enable anchoring
          position: 'relative',

          // resizeable image
          '& picture': { display: 'flex', justifyContent: 'center' },
          '& img': { maxWidth: '100%', maxHeight: '100%' },
          '&:hover .overlay-buttons': { opacity: 1 },
          '&:hover .overlay-text': { opacity: 1 },

          // layout
          display: 'grid',
          justifyContent: 'center',
          alignItems: 'center',

          // this shall apply font scaling and maybe margins, not much
          ...props.scaledImageSx,
        }}
      >

        {/* Main */}
        <Box sx={{ position: 'relative' }}>

          {/* Image / Loading Indicator */}
          {props.imageURL ? (
            <picture>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={props.imageURL} alt={props.infoText ? `Generated Image: ${props.infoText}` : 'Generated Image'} />
            </picture>
          ) : (
            <Box
              sx={{
                flex: 1,
                p: { xs: 1, md: 3 },
                overflowWrap: 'anywhere',
                whiteSpace: 'break-spaces',
                display: 'block',
              }}
            >
              {loadingTimeout ? 'Could not load image' : 'Loading...'}
            </Box>
          )}

          {/* Description Overlay */}
          {!!props.description && (
            <Box className='overlay-text' sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: `rgba(0 0 0 / 0.85)`,
              // backgroundColor: `rgba(${theme.vars.palette.neutral.darkChannel} / 0.85)`,
              p: { xs: 1, md: 2 },
              opacity: infoOpen ? 1 : 0,
              transition: 'opacity 0.2s cubic-bezier(.17,.84,.44,1)',
            }}>
              {props.description}
            </Box>
          )}
        </Box>

        {/* Information */}
        {!!props.infoText && infoOpen && (
          <Box sx={{
            p: { xs: 1, md: 2 },
            overflowWrap: 'anywhere',
            whiteSpace: 'break-spaces',
          }}>
            {props.infoText}
          </Box>
        )}

        {/* (overlay) Image Buttons */}
        <Box className='overlay-buttons' sx={{
          ...overlayButtonsSx,
          p: 0.5,
          display: 'grid',
          gridTemplateColumns: 'auto auto',
          gap: 0.5,
        }}>

          {(!!props.infoText || !!props.description) && (
            <GoodTooltip title={infoOpen ? 'Hide Prompt' : 'Show Prompt'}>
              <OverlayButton variant={infoOpen ? 'solid' : 'soft'} onClick={handleToggleInfoOpen}>
                <InfoOutlinedIcon />
              </OverlayButton>
            </GoodTooltip>
          )}

          {!!props.imageURL && (
            <GoodTooltip title='Open in new tab'>
              {props.onOpenInNewTab ? (
                <OverlayButton variant='soft' onClick={handleOpenInNewTab}>
                  <OpenInNewIcon />
                </OverlayButton>
              ) : props.imageURL.startsWith('http') ? (
                <OverlayButton variant='soft' component={Link} href={props.imageURL} download={props.infoText || 'Image'} target='_blank'>
                  <OpenInNewIcon />
                </OverlayButton>
              ) : <span />}
            </GoodTooltip>
          )}

          {/* Regenerate [armed, arming] buttons */}
          {regenArmed && (
            <GoodTooltip title='Confirm Regeneration'>
              <OverlayButton variant='soft' color='success' onClick={handleImageRegenerate} sx={{ gridRow: '2', gridColumn: '1' }}>
                <ReplayIcon />
              </OverlayButton>
            </GoodTooltip>
          )}

          {!!onImageRegenerate && (
            <GoodTooltip title={regenArmed ? 'Cancel Regeneration' : 'Draw again with the current drawing configuration'}>
              <OverlayButton variant={regenArmed ? 'solid' : 'soft'} onClick={handleToggleRegenArmed} sx={{ gridRow: '2', gridColumn: '2' }}>
                {regenArmed
                  ? <CloseRoundedIcon />
                  : <ReplayIcon />
                }
              </OverlayButton>
            </GoodTooltip>
          )}

        </Box>
      </Sheet>


      {/* (Remove in 2025) Dalle Warning notice */}
      {isTempDalleUrl && showDalleAlert && (
        <Alert
          variant='soft' color='neutral'
          startDecorator={<WarningRoundedIcon />}
          endDecorator={
            <IconButton variant='soft' aria-label='Close Alert' onClick={() => setShowDalleAlert(on => !on)} sx={{ my: -0.5 }}>
              <CloseRoundedIcon />
            </IconButton>
          }
          sx={{
            mx: 0.5,
            ...props.scaledImageSx,
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
