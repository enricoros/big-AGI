import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Sheet } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ReplayIcon from '@mui/icons-material/Replay';

import type { RenderBlockInputs } from '../blocks.types';
import { OverlayButton, overlayButtonsActiveSx, overlayButtonsClassName, overlayButtonsTopRightSx } from '../OverlayButton';


/// Heuristics to parse Markdown images (as URLs) ///

/**
 * Checks if the entire content consists solely of Markdown image references.
 * If so, returns an array of ImageBlock objects for each image reference.
 * If any non-image content is present or if there are no image references, returns null.
 */
export function heuristicAllMarkdownImageReferences(fullText: string) {

  // Check if all lines are valid Markdown image references with image URLs
  const imageBlocks: RenderBlockInputs = [];
  for (const line of fullText.split('\n')) {
    if (line.trim() === '') continue; // skip empty lines
    const match = mdImageReferenceRegex.exec(line);
    if (match && imageExtensions.test(match[2])) {
      const alt = match[1];
      const url = match[2];
      imageBlocks.push({ bkt: 'img-url-bk', url, alt });
    } else {
      // if there is any outlier line, return null
      return null;
    }
  }

  // Return the image blocks if all lines are image references with valid image URLs
  return imageBlocks.length > 0 ? imageBlocks : null;
}

const mdImageReferenceRegex = /^!\[([^\]]*)]\(([^)]+)\)$/;
const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|svg)/i;


const overlayButtonsGridSx: SxProps = {
  ...overlayButtonsTopRightSx,
  display: 'grid',
  gridTemplateColumns: 'auto auto',
  gap: 0.5,
};

export type RenderImageURLVariant = 'content-part' | 'attachment-card' | 'attachment-button';

/**
 * Renders an Image Data URL, or a remote URL.
 */
export const RenderImageURL = (props: {
  imageURL: string | null,        // remote URL, or data URL: `data:image/png;base64,...`
  overlayText?: React.ReactNode,  // bottom overlay text
  expandableText?: string,        // expandable pane below the image
  variant: RenderImageURLVariant,  // either a responsive Block image, or an inline Card
  disabled?: boolean,             // if true, interaction is disabled
  onImageDelete?: () => void,
  onImageRegenerate?: () => void,
  onClick?: (e: React.MouseEvent) => void,  // use this generic as a fallback, but should not be needed
  onViewImage?: (e: React.MouseEvent) => void,
  scaledImageSx?: SxProps,
  className?: string,
}) => {

  // state
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);
  const [deleteArmed, setDeleteArmed] = React.useState(false);
  const [regenArmed, setRegenArmed] = React.useState(false);

  // Effect
  React.useEffect(() => {
    const timeout = setTimeout(() => setLoadingTimeout(true), 2000);
    return () => clearTimeout(timeout);
  }, []);

  // handlers
  const { onImageDelete, onImageRegenerate, onViewImage } = props;

  const handleToggleInfoOpen = React.useCallback(() => {
    setDeleteArmed(false);
    setRegenArmed(false);
    setInfoOpen(open => !open);
  }, []);

  const handleViewImage = React.useCallback((e: React.MouseEvent) => {
    setDeleteArmed(false);
    setRegenArmed(false);
    onViewImage?.(e);
  }, [onViewImage]);

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
    // immediate regeneration if shift is pressed
    if (!regenArmed && event.shiftKey) // immediately regenerate:image
      return handleImageRegenerate();
    setDeleteArmed(false);
    setRegenArmed(armed => !armed);
  }, [handleImageRegenerate, regenArmed]);

  const handleImageClick = React.useCallback((e: React.MouseEvent) => {
    if (onViewImage) {
      e.stopPropagation();
      handleViewImage(e);
    } else if (props.imageURL?.startsWith('http')) {
      e.stopPropagation();
      window.open(props.imageURL, '_blank', 'noopener,noreferrer');
    }
  }, [onViewImage, handleViewImage, props.imageURL]);


  // derived state
  const isCard = props.variant === 'attachment-card';
  const isImageClickable = !props.disabled && (!!onViewImage || (!!props.imageURL && props.imageURL.startsWith('http')));

  // Only show regeneration in modal context (when not showing a viewer button)
  const showRegenerate = !!onImageRegenerate && !onViewImage;
  const isOnButton = props.variant === 'attachment-button';


  return (
    <Sheet
      color={isCard ? 'primary' : undefined}
      variant={isCard ? 'outlined' : 'solid'}
      aria-disabled={props.disabled}
      onClick={props.onClick}
      className={props.className}
      sx={{
        // style
        mx: isOnButton ? undefined : 1.5,  // 1.5 like the other 'Render*' components
        minWidth: isOnButton ? 20 : 256,
        minHeight: isOnButton ? 20 : 128,
        boxShadow: isCard ? undefined : isOnButton ? '0 2px 6px 0 rgba(0, 0, 0, 0.2)' : 'sm',

        // enable anchoring
        position: 'relative',

        // resizeable image
        '& picture': { display: 'flex', justifyContent: 'center' },
        '& img': { maxWidth: '100%', maxHeight: '100%', filter: props.disabled ? 'grayscale(100%)' : undefined },
        [`&:hover > .${overlayButtonsClassName}`]: overlayButtonsActiveSx,
        '&:hover .overlay-text': overlayButtonsActiveSx,

        // layout
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',

        // this shall apply font scaling and maybe margins, not much
        ...props.scaledImageSx,
      }}
    >

      {/* Image and Overlay - clickable to view/maximize */}
      <Box sx={{ position: 'relative', cursor: isImageClickable ? 'pointer' : undefined }} onClick={isImageClickable ? handleImageClick : undefined}>

        {/* Image / Loading Indicator */}
        {props.imageURL ? (
          <picture>
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
            {loadingTimeout ? 'Image Missing' : 'Loading...'}
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
            transition: 'opacity 0.16s cubic-bezier(.17,.84,.44,1)',
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

      {/* [overlay] Buttons (RenderImage) */}
      {!props.disabled && <Box className={overlayButtonsClassName} sx={overlayButtonsGridSx}>

        {/* Info toggle */}
        {!!props.expandableText && (
          <OverlayButton tooltip={infoOpen ? 'Hide Prompt' : 'Show Prompt'} variant={infoOpen ? 'solid' : 'outlined'} color={isCard ? 'primary' : undefined} onClick={handleToggleInfoOpen} sx={{ gridRow: '1', gridColumn: '1' }}>
            <InfoOutlinedIcon />
          </OverlayButton>
        )}

        {/* Delete toggle/cancel */}
        {!!onImageDelete && !regenArmed && (
          <OverlayButton tooltip={deleteArmed ? 'Cancel Deletion' : 'Delete Image'} placement='bottom' variant={deleteArmed ? 'solid' : 'outlined'} color={isCard ? 'primary' : undefined} onClick={handleToggleDeleteArmed} sx={{ gridRow: '1', gridColumn: '2' }}>
            {deleteArmed ? <CloseRoundedIcon /> : <DeleteOutlineIcon />}
          </OverlayButton>
        )}

        {/* Delete confirm (armed) */}
        {deleteArmed && !regenArmed && (
          <OverlayButton tooltip='Confirm Deletion' placement='bottom' variant='outlined' color='danger' onClick={onImageDelete} sx={{ gridRow: '2', gridColumn: '2' }}>
            <DeleteForeverIcon sx={{ color: 'danger.solidBg' }} />
          </OverlayButton>
        )}

        {/* Regenerate toggle/cancel - only in modal context (click image to view inline) */}
        {showRegenerate && !deleteArmed && (
          <OverlayButton tooltip={regenArmed ? 'Cancel Regeneration' : 'Draw again'} placement='bottom' variant={regenArmed ? 'solid' : 'outlined'} onClick={handleToggleRegenArmed} sx={{ gridRow: onImageDelete ? '2' : '1', gridColumn: onImageDelete ? '1' : '2' }}>
            {regenArmed ? <CloseRoundedIcon /> : <ReplayIcon />}
          </OverlayButton>
        )}

        {/* Regenerate confirm (armed) */}
        {regenArmed && !deleteArmed && (
          <OverlayButton tooltip='Confirm Regeneration' placement='bottom' variant='outlined' color='success' onClick={handleImageRegenerate} sx={{ gridRow: '2', gridColumn: '2' }}>
            <ReplayIcon sx={{ color: 'success.solidBg' }} />
          </OverlayButton>
        )}

      </Box>}
    </Sheet>
  );
};
