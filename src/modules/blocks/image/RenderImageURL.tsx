import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, IconButton, Sheet } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReplayIcon from '@mui/icons-material/Replay';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { Link } from '~/common/components/Link';

import type { ImageBlock } from '../blocks.types';
import { OverlayButton, overlayButtonsSx } from '../code/RenderCode';


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


export type RenderImageURLVarint = 'content-part' | 'attachment-card';

export const RenderImageURL = (props: {
  imageURL: string | null,              // remote URL, or data URL
  overlayText?: React.ReactNode, // bottom overlay text
  expandableText?: string,          // expandable pane below the image
  variant: RenderImageURLVarint,        // either a responsive Block image, or an inline Card
  onOpenInNewTab?: (e: React.MouseEvent) => void,
  onImageDelete?: () => void,
  onImageRegenerate?: () => void,
  scaledImageSx?: SxProps,
  className?: string,
}) => {

  // state
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);
  const [deleteArmed, setDeleteArmed] = React.useState(false);
  const [regenArmed, setRegenArmed] = React.useState(false);
  const [showDalleAlert, setShowDalleAlert] = React.useState(true);

  // Effect
  React.useEffect(() => {
    const timeout = setTimeout(() => setLoadingTimeout(true), 2000);
    return () => clearTimeout(timeout);
  }, []);

  // handlers
  const { onImageDelete, onImageRegenerate, onOpenInNewTab } = props;

  const handleToggleInfoOpen = React.useCallback(() => {
    setDeleteArmed(false);
    setRegenArmed(false);
    setInfoOpen(open => !open);
  }, []);

  const handleOpenInNewTab = React.useCallback((e: React.MouseEvent) => {
    setDeleteArmed(false);
    setRegenArmed(false);
    onOpenInNewTab?.(e);
  }, [onOpenInNewTab]);

  const handleToggleDeleteArmed = React.useCallback((event: React.MouseEvent) => {
    // immediate deletion if shift is pressed
    if (!deleteArmed && event.shiftKey) // immediately delete:image
      return onImageDelete?.();
    setRegenArmed(false);
    setDeleteArmed(armed => !armed);
  }, [deleteArmed, onImageDelete]);

  const handleImageRegenerate = React.useCallback(() => {
    setDeleteArmed(false);
    setRegenArmed(false);
    onImageRegenerate?.();
  }, [onImageRegenerate]);

  const handleToggleRegenArmed = React.useCallback((event: React.MouseEvent) => {
    // imemdiate regeneration if shift is presset
    if (!regenArmed && event.shiftKey) // immediately regenerate:image
      return handleImageRegenerate();
    setDeleteArmed(false);
    setRegenArmed(armed => !armed);
  }, [handleImageRegenerate, regenArmed]);


  // derived state
  const isCard = props.variant === 'attachment-card';
  const isTempDalleUrl = props.imageURL?.startsWith('https://oaidalle') || false;


  return (
    <Box>

      <Sheet
        color={isCard ? 'primary' : undefined}
        variant={isCard ? 'outlined' : 'solid'}
        className={props.className}
        sx={{
          // style
          mx: 1.5,  // 1.5 like the other 'Render*' components
          minWidth: 256,
          minHeight: 128,
          boxShadow: isCard ? undefined : 'md',

          // enable anchoring
          position: 'relative',

          // resizeable image
          '& picture': { display: 'flex', justifyContent: 'center' },
          '& img': { maxWidth: '100%', maxHeight: '100%' },
          '&:hover .overlay-buttons': { opacity: 1 },
          '&:hover .overlay-text': { opacity: 1 },

          // layout
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',

          // this shall apply font scaling and maybe margins, not much
          ...props.scaledImageSx,
        }}
      >

        {/* Image and Overlay */}
        <Box sx={{ position: 'relative' }}>

          {/* Image / Loading Indicator */}
          {props.imageURL ? (
            <picture>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={props.imageURL} alt={props.expandableText ? `Generated Image: ${props.expandableText}` : 'Generated Image'} />
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

          {/* [overlay] Description */}
          {!!props.overlayText && (
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
              {props.overlayText}
            </Box>
          )}
        </Box>

        {/* Bottom Expander: information */}
        {!!props.expandableText && infoOpen && (
          <Box sx={{
            p: { xs: 1, md: 2 },
            overflowWrap: 'anywhere',
            whiteSpace: 'break-spaces',
          }}>
            {props.expandableText}
          </Box>
        )}

        {/* [overlay] Buttons */}
        <Box className='overlay-buttons' sx={{
          ...overlayButtonsSx,
          p: 0.5,
          display: 'grid',
          gridTemplateColumns: 'auto auto',
          gap: 0.5,
        }}>

          {!!props.expandableText && (
            <GoodTooltip title={infoOpen ? 'Hide Prompt' : 'Show Prompt'}>
              <OverlayButton variant={infoOpen ? 'solid' : 'soft'} color={isCard ? 'primary' : undefined} onClick={handleToggleInfoOpen} sx={{ gridRow: '1', gridColumn: '1' }}>
                <InfoOutlinedIcon />
              </OverlayButton>
            </GoodTooltip>
          )}

          {!!props.imageURL && (
            <GoodTooltip title='Open in new tab'>
              {props.onOpenInNewTab ? (
                <OverlayButton variant='soft' color={isCard ? 'primary' : undefined} onClick={handleOpenInNewTab} sx={{ gridRow: '1', gridColumn: '2' }}>
                  <OpenInNewIcon />
                </OverlayButton>
              ) : props.imageURL.startsWith('http') ? (
                <OverlayButton variant='soft' color={isCard ? 'primary' : undefined} component={Link} href={props.imageURL} download={props.expandableText || 'Image'} target='_blank' sx={{ gridRow: '1', gridColumn: '2' }}>
                  <OpenInNewIcon />
                </OverlayButton>
              ) : <span />}
            </GoodTooltip>
          )}


          {/* Deletion */}

          {deleteArmed && !regenArmed && (
            <GoodTooltip title='Confirm Deletion'>
              <OverlayButton variant='soft' color='danger' onClick={onImageDelete} sx={{ gridRow: '2', gridColumn: '1' }}>
                <DeleteForeverIcon sx={{ color: 'danger.solidBg' }} />
              </OverlayButton>
            </GoodTooltip>
          )}

          {!!onImageDelete && !regenArmed && (
            <GoodTooltip title={deleteArmed ? 'Cancel Deletion' : 'Delete Image'}>
              <OverlayButton variant={deleteArmed ? 'solid' : 'soft'} color={isCard ? 'primary' : undefined} onClick={handleToggleDeleteArmed} sx={{ gridRow: '2', gridColumn: '2' }}>
                {deleteArmed ? <CloseRoundedIcon /> : <DeleteOutlineIcon />}
              </OverlayButton>
            </GoodTooltip>
          )}

          {!!onImageRegenerate && !deleteArmed && (
            <GoodTooltip title={regenArmed ? 'Cancel Regeneration' : 'Draw again with the present configuration'}>
              <OverlayButton variant={regenArmed ? 'solid' : 'soft'} onClick={handleToggleRegenArmed} sx={{ gridRow: '2', gridColumn: '1' }}>
                {regenArmed
                  ? <CloseRoundedIcon />
                  : <ReplayIcon />
                }
              </OverlayButton>
            </GoodTooltip>
          )}

          {/* Regenerate [armed, arming] buttons */}
          {regenArmed && !deleteArmed && (
            <GoodTooltip title='Confirm Regeneration'>
              <OverlayButton variant='soft' color='success' onClick={handleImageRegenerate} sx={{ gridRow: '2', gridColumn: '2' }}>
                <ReplayIcon sx={{ color: 'success.solidBg' }} />
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
