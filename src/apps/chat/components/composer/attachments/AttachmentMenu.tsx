import * as React from 'react';

import { Box, ListDivider, ListItemDecorator, MenuItem, Radio, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { copyToClipboard } from '~/common/util/clipboardUtils';

import type { LLMAttachment } from './useLLMAttachments';
import { useAttachmentsStore } from './store-attachments';


// enable for debugging
export const DEBUG_ATTACHMENTS = true;


export function AttachmentMenu(props: {
  llmAttachment: LLMAttachment,
  menuAnchor: HTMLAnchorElement,
  isPositionFirst: boolean,
  isPositionLast: boolean,
  onAttachmentInlineText: (attachmentId: string) => void,
  onClose: () => void,
}) {

  // derived state

  const isPositionFixed = props.isPositionFirst && props.isPositionLast;

  const {
    attachment,
    attachmentOutputs,
    isUnconvertible,
    isOutputMissing,
    isOutputTextInlineable,
    tokenCountApprox,
  } = props.llmAttachment;

  const {
    id: aId,
    input: aInput,
    converters: aConverters,
    converterIdx: aConverterIdx,
    outputs: aOutputs,
  } = attachment;


  // operations

  const { onClose, onAttachmentInlineText } = props;

  const handleInlineText = React.useCallback(() => {
    onClose();
    onAttachmentInlineText(aId);
  }, [aId, onAttachmentInlineText, onClose]);

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

  const handleSetConverterIdx = React.useCallback(async (converterIdx: number | null) => {
    return useAttachmentsStore.getState().setConverterIdx(aId, converterIdx);
  }, [aId]);

  // const handleSummarizeText = React.useCallback(() => {
  //   onAttachmentSummarizeText(aId);
  // }, [aId, onAttachmentSummarizeText]);

  const handleCopyOutputToClipboard = React.useCallback(() => {
    if (attachmentOutputs.length >= 1) {
      const concat = attachmentOutputs.map(output => {
        if (output.type === 'text-block')
          return output.text;
        else if (output.type === 'image-part')
          return output.base64Url;
        else
          return null;
      }).join('\n\n---\n\n');
      copyToClipboard(concat.trim(), 'Converted attachment');
    }
  }, [attachmentOutputs]);


  return (
    <CloseableMenu
      dense placement='top'
      open anchorEl={props.menuAnchor} onClose={props.onClose}
      sx={{ minWidth: 200 }}
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

      {/* Render Converters as menu items */}
      {/*{!isUnconvertible && <ListItem>*/}
      {/*  <Typography level='body-md'>*/}
      {/*    Attach as:*/}
      {/*  </Typography>*/}
      {/*</ListItem>}*/}
      {!isUnconvertible && aConverters.map((c, idx) =>
        <MenuItem
          disabled={c.disabled}
          key={'c-' + c.id}
          onClick={async () => idx !== aConverterIdx && await handleSetConverterIdx(idx)}
        >
          <ListItemDecorator>
            <Radio checked={idx === aConverterIdx} />
          </ListItemDecorator>
          {c.unsupported
            ? <Box>Unsupported 🤔 <Typography level='body-xs'>{c.name}</Typography></Box>
            : c.name}
        </MenuItem>,
      )}
      {!isUnconvertible && <ListDivider />}

      {DEBUG_ATTACHMENTS && !!aInput && (
        <MenuItem onClick={handleCopyOutputToClipboard} disabled={!isOutputTextInlineable}>
          <ListItemDecorator><ContentCopyIcon /></ListItemDecorator>
          <Box>
            {!!aInput && <Typography level='body-xs'>
              🡐 {aInput.mimeType}, {aInput.dataSize.toLocaleString()} bytes
            </Typography>}
            {/*<Typography level='body-xs'>*/}
            {/*  Converters: {aConverters.map(((converter, idx) => ` ${converter.id}${(idx === aConverterIdx) ? '*' : ''}`)).join(', ')}*/}
            {/*</Typography>*/}
            <Typography level='body-xs'>
              🡒 {isOutputMissing ? 'empty' : aOutputs.map(output => `${output.type}, ${output.type === 'text-block'
              ? output.text.length.toLocaleString()
              : output.type === 'image-part'
                ? output.base64Url.length.toLocaleString()
                : '(other)'} bytes`).join(' · ')}
            </Typography>
            {!!tokenCountApprox && <Typography level='body-xs'>
              🡒 {tokenCountApprox.toLocaleString()} tokens
            </Typography>}
          </Box>
        </MenuItem>
      )}
      {DEBUG_ATTACHMENTS && !!aInput && <ListDivider />}

      {/* Destructive Operations */}
      {/*<MenuItem onClick={handleCopyOutputToClipboard} disabled={!isOutputTextInlineable}>*/}
      {/*  <ListItemDecorator><ContentCopyIcon /></ListItemDecorator>*/}
      {/*  Copy*/}
      {/*</MenuItem>*/}
      {/*<MenuItem onClick={handleSummarizeText} disabled={!isOutputTextInlineable}>*/}
      {/*  <ListItemDecorator><CompressIcon color='success' /></ListItemDecorator>*/}
      {/*  Shrink*/}
      {/*</MenuItem>*/}
      <MenuItem onClick={handleInlineText} disabled={!isOutputTextInlineable}>
        <ListItemDecorator><VerticalAlignBottomIcon /></ListItemDecorator>
        Inline text
      </MenuItem>
      <MenuItem onClick={handleRemove}>
        <ListItemDecorator><ClearIcon /></ListItemDecorator>
        Remove
      </MenuItem>

    </CloseableMenu>
  );
}