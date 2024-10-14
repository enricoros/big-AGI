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

import { Link } from '~/common/components/Link';

import { RenderBlockInputs } from '../blocks.types';
import { OverlayButton, overlayButtonsActiveSx, overlayButtonsClassName, overlayButtonsTopRightSx, StyledOverlayButton } from '../OverlayButton';


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

export const RenderImageURL = (props: {
  imageURL: string | null,        // remote URL, or data URL: `data:image/png;base64,...`
  overlayText?: React.ReactNode,  // bottom overlay text
  expandableText?: string,        // expandable pane below the image
  variant: RenderImageURLVariant,  // either a responsive Block image, or an inline Card
  disabled?: boolean,             // if true, interaction is disabled
  onOpenInNewTab?: (e: React.MouseEvent) => void,
  onImageDelete?: () => void,
  onImageRegenerate?: () => void,
  onClick?: (e: React.MouseEvent) => void,  // use this generic as a fallback, but should not be needed
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
  const isOnButton = props.variant === 'attachment-button';
  const isTempDalleUrl = props.imageURL?.startsWith('https://oaidalle') || false;


  return (
    <Box>

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

          {!!props.expandableText && (
            <OverlayButton tooltip={infoOpen ? 'Hide Prompt' : 'Show Prompt'} variant={infoOpen ? 'solid' : 'outlined'} color={isCard ? 'primary' : undefined} onClick={handleToggleInfoOpen} sx={{ gridRow: '1', gridColumn: '1' }}>
              <InfoOutlinedIcon />
            </OverlayButton>
          )}

          {!!props.imageURL && (
            props.onOpenInNewTab ? (
              <OverlayButton tooltip='Open in new tab' variant='outlined' color={isCard ? 'primary' : undefined} onClick={handleOpenInNewTab} sx={{ gridRow: '1', gridColumn: '2' }}>
                <OpenInNewIcon />
              </OverlayButton>
            ) : props.imageURL.startsWith('http') ? (
              <StyledOverlayButton variant='outlined' color={isCard ? 'primary' : undefined} component={Link} href={props.imageURL} download={props.expandableText || 'Image'} target='_blank' sx={{ gridRow: '1', gridColumn: '2' }}>
                <OpenInNewIcon />
              </StyledOverlayButton>
            ) : <span />
          )}


          {/* Deletion */}

          {deleteArmed && !regenArmed && (
            <OverlayButton tooltip='Confirm Deletion' placement='bottom' variant='outlined' color='danger' onClick={onImageDelete} sx={{ gridRow: '2', gridColumn: '1' }}>
              <DeleteForeverIcon sx={{ color: 'danger.solidBg' }} />
            </OverlayButton>
          )}

          {!!onImageDelete && !regenArmed && (
            <OverlayButton tooltip={deleteArmed ? 'Cancel Deletion' : 'Delete Image'} placement='bottom' variant={deleteArmed ? 'solid' : 'outlined'} color={isCard ? 'primary' : undefined} onClick={handleToggleDeleteArmed} sx={{ gridRow: '2', gridColumn: '2' }}>
              {deleteArmed ? <CloseRoundedIcon /> : <DeleteOutlineIcon />}
            </OverlayButton>
          )}

          {!!onImageRegenerate && !deleteArmed && (
            <OverlayButton tooltip={regenArmed ? 'Cancel Regeneration' : 'Draw again with the present configuration'} placement='bottom' variant={regenArmed ? 'solid' : 'outlined'} onClick={handleToggleRegenArmed} sx={{ gridRow: '2', gridColumn: '1' }}>
              {regenArmed
                ? <CloseRoundedIcon />
                : <ReplayIcon />
              }
            </OverlayButton>
          )}

          {/* Regenerate [armed, arming] buttons */}
          {regenArmed && !deleteArmed && (
            <OverlayButton tooltip='Confirm Regeneration' placement='bottom' variant='outlined' color='success' onClick={handleImageRegenerate} sx={{ gridRow: '2', gridColumn: '2' }}>
              <ReplayIcon sx={{ color: 'success.solidBg' }} />
            </OverlayButton>
          )}

        </Box>}
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
