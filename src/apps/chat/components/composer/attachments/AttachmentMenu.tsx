import * as React from 'react';

import { Box, ListDivider, ListItemDecorator, MenuItem, Radio, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { copyToClipboard } from '~/common/util/clipboardUtils';

import { Attachment, useAttachmentsStore } from './store-attachments';


// enable for debugging
export const DEBUG_ATTACHMENTS = true;


export function AttachmentMenu(props: {
  menuAnchor: HTMLAnchorElement,
  attachment: Attachment,
  isPositionFirst: boolean,
  isPositionLast: boolean,
  onAttachmentInline: (attachmentId: string) => void,
  onClose: () => void,
}) {

  // derived state
  const isPositionFixed = props.isPositionFirst && props.isPositionLast;

  const {
    id: aId,
    input: aInput,
    conversions: aConversions,
    conversionIdx: aConversionIdx,
    outputs: aOutputs,
  } = props.attachment;

  const isUnconverted = aConversions.length === 0;
  const isOutputExpectedAndMissing = aOutputs?.length === 0;


  // operations

  const { onAttachmentInline, onClose } = props;

  const handleInline = React.useCallback(() => {
    onClose();
    onAttachmentInline(aId);
  }, [onClose, onAttachmentInline, aId]);

  const handleMoveUp = React.useCallback(() => {
    useAttachmentsStore.getState().moveAttachment(aId, -1);
  }, [aId]);

  const handleMoveDown = React.useCallback(() => {
    useAttachmentsStore.getState().moveAttachment(aId, 1);
  }, [aId]);

  const handleRemove = React.useCallback(() => {
    onClose();
    useAttachmentsStore.getState().removeAttachment(aId);
  }, [aId, onClose]);

  const handleSetConversionIdx = React.useCallback(async (conversionIdx: number | null) =>
      useAttachmentsStore.getState().setConversionIdx(aId, conversionIdx)
    , [aId]);

  const handleCopyOutputToClipboard = React.useCallback(() => {
    if (aOutputs && aOutputs.length >= 1) {
      const concat = aOutputs.map(output => {
        if (output.type === 'text-block')
          return output.text;
        else if (output.type === 'image-part')
          return output.base64Url;
        else
          return null;
      }).join('\n\n');
      copyToClipboard(concat, 'Converted attachment');
    }
  }, [aOutputs]);


  return (
    <CloseableMenu
      placement='top' sx={{ minWidth: 200 }}
      open anchorEl={props.menuAnchor} onClose={props.onClose}
      noTopPadding noBottomPadding
    >

      {/* Move Arrows */}
      {!isPositionFixed && <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <MenuItem
          disabled={props.isPositionFirst}
          onClick={handleMoveUp}
          sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}
        >
          <KeyboardArrowLeftIcon />
        </MenuItem>
        <MenuItem
          disabled={props.isPositionLast}
          onClick={handleMoveDown}
          sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}
        >
          <KeyboardArrowRightIcon />
        </MenuItem>
      </Box>}
      {!isPositionFixed && <ListDivider sx={{ mt: 0 }} />}

      {/* Render Conversions as menu items */}
      {/*{!isUnconverted && <ListItem>*/}
      {/*  <Typography level='body-md'>*/}
      {/*    Attach as:*/}
      {/*  </Typography>*/}
      {/*</ListItem>}*/}
      {!isUnconverted && aConversions.map((conversion, idx) =>
        <MenuItem
          disabled={conversion.disabled}
          key={'c-' + conversion.id}
          onClick={async () => idx !== aConversionIdx && await handleSetConversionIdx(idx)}
        >
          <ListItemDecorator>
            <Radio checked={idx === aConversionIdx} />
          </ListItemDecorator>
          {conversion.unsupported ? <Box>
            Unsupported 🤔
            <Typography level='body-xs'>
              {conversion.name}
            </Typography>
          </Box> : conversion.name}
        </MenuItem>,
      )}
      {!isUnconverted && <ListDivider />}

      {DEBUG_ATTACHMENTS && !!aInput && (
        <MenuItem onClick={handleCopyOutputToClipboard}>
          <Box>
            {!!aInput && <Typography level='body-xs'>
              🡐 {aInput.mimeType}, {aInput.dataSize.toLocaleString()} bytes
            </Typography>}
            {/*<Typography level='body-xs'>*/}
            {/*  Conversions: {aConversions.map(((conversion, idx) => ` ${conversion.id}${(idx === aConversionIdx) ? '*' : ''}`)).join(', ')}*/}
            {/*</Typography>*/}
            <Typography level='body-xs'>
              🡒 {isOutputExpectedAndMissing ? 'empty' : aOutputs?.map(output => `${output.type}, ${output.type === 'text-block' ? output.text.length.toLocaleString() : '(base64 image)'} bytes`).join(' · ')}
            </Typography>
          </Box>
        </MenuItem>
      )}
      {DEBUG_ATTACHMENTS && !!aInput && <ListDivider />}

      {/* Destructive Operations */}
      <MenuItem onClick={handleInline} disabled={isUnconverted || isOutputExpectedAndMissing}>
        <ListItemDecorator><VerticalAlignBottomIcon /></ListItemDecorator>
        Inline
      </MenuItem>
      <MenuItem onClick={handleRemove}>
        <ListItemDecorator><ClearIcon /></ListItemDecorator>
        Remove
      </MenuItem>

    </CloseableMenu>
  );
}