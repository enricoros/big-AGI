import * as React from 'react';

import { Box, IconButton, Link, ListDivider, ListItem, ListItemDecorator, MenuItem, Radio, Tooltip, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import LaunchIcon from '@mui/icons-material/Launch';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

import { getImageBlobURLById } from '~/modules/dblobs/dblobs.db';

import type { DContentRef } from '~/common/stores/chat/chat.message';
import { CloseableMenu } from '~/common/components/CloseableMenu';
import { copyToClipboard } from '~/common/util/clipboardUtils';

import type { AttachmentDraftsStoreApi } from '~/common/attachment-drafts/store-attachment-drafts-slice';

import type { LLMAttachment } from './useLLMAttachments';


// enable for debugging
export const DEBUG_LLMATTACHMENTS = true;


/**
 * Note: this utility function could be extracted more broadly to chat.message.ts, but
 * I don't want to introduce a (circular) dependency from chat.message.ts to dblobs.db.ts.
 */
async function handleShowContentInNewTab(source: DContentRef) {
  console.log('handleShowContentInNewTab', source);
  let imageUrl: string | null = null;
  if (source.reftype === 'url')
    imageUrl = source.url;
  else if (source.reftype === 'dblob')
    imageUrl = await getImageBlobURLById(source.dblobId);
  if (imageUrl && typeof window !== 'undefined')
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
}


export function LLMAttachmentMenu(props: {
  attachmentDraftsStoreApi: AttachmentDraftsStoreApi,
  llmAttachment: LLMAttachment,
  menuAnchor: HTMLAnchorElement,
  isPositionFirst: boolean,
  isPositionLast: boolean,
  onAttachmentDraftInlineText: (attachmentDraftId: string) => void,
  onClose: () => void,
}) {

  // derived state

  const isPositionFixed = props.isPositionFirst && props.isPositionLast;

  const {
    attachmentDraft,
    attachmentDraftCollapsedParts,
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
    outputParts: aOutputParts,
  } = attachmentDraft;


  // operations

  const { attachmentDraftsStoreApi, onClose, onAttachmentDraftInlineText } = props;

  const handleInlineText = React.useCallback(() => {
    onClose();
    onAttachmentDraftInlineText(aId);
  }, [aId, onAttachmentDraftInlineText, onClose]);

  const handleMoveUp = React.useCallback(() => {
    attachmentDraftsStoreApi.getState().moveAttachmentDraft(aId, -1);
  }, [aId, attachmentDraftsStoreApi]);

  const handleMoveDown = React.useCallback(() => {
    attachmentDraftsStoreApi.getState().moveAttachmentDraft(aId, 1);
  }, [aId, attachmentDraftsStoreApi]);

  const handleRemove = React.useCallback(() => {
    onClose();
    attachmentDraftsStoreApi.getState().removeAttachmentDraft(aId);
  }, [aId, attachmentDraftsStoreApi, onClose]);

  const handleSetConverterIdx = React.useCallback(async (converterIdx: number | null) => {
    return attachmentDraftsStoreApi.getState().setAttachmentDraftConverterIdxAndConvert(aId, converterIdx);
  }, [aId, attachmentDraftsStoreApi]);

  // const handleSummarizeText = React.useCallback(() => {
  //   onAttachmentDraftSummarizeText(aId);
  // }, [aId, onAttachmentDraftSummarizeText]);

  const handleCopyOutputToClipboard = React.useCallback(() => {
    if (attachmentDraftCollapsedParts.length >= 1) {
      const concat = attachmentDraftCollapsedParts.map(output => {
        if (output.atype === 'atext')
          return output.text;
        else if (output.atype === 'aimage')
          return output.title;
        else
          return null;
      }).join('\n\n---\n\n');
      copyToClipboard(concat.trim(), 'Converted attachment');
    }
  }, [attachmentDraftCollapsedParts]);


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

      {DEBUG_LLMATTACHMENTS && !!aInput && (
        <ListItem>
          <ListItemDecorator>
            {isOutputTextInlineable && (
              <Tooltip title='Copy Text to clipboard'>
                <IconButton size='sm' onClick={handleCopyOutputToClipboard} disabled={!isOutputTextInlineable} sx={{ ml: -0.5 }}>
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
            )}
          </ListItemDecorator>
          <Box>
            {!!aInput && <Typography level='body-xs'>
              🡐 {aInput.mimeType}, {aInput.dataSize.toLocaleString()} bytes
            </Typography>}
            {/*<Typography level='body-xs'>*/}
            {/*  Converters: {aConverters.map(((converter, idx) => ` ${converter.id}${(idx === aConverterIdx) ? '*' : ''}`)).join(', ')}*/}
            {/*</Typography>*/}
            <Box>
              {isOutputMissing ? (
                <Typography level='body-xs'>🡒 ...</Typography>
              ) : (
                aOutputParts.map((output, index) => {
                  if (output.atype === 'aimage') {
                    const resolution = output.width && output.height ? `${output.width} x ${output.height}` : 'unknown resolution';
                    const mime = output.source.reftype === 'dblob' ? output.source.mimeType : 'unknown image';
                    return (
                      <Typography key={index} level='body-xs'>
                        🡒 {mime.replace('image/', 'img: ')}, {resolution}, {output.source.reftype === 'dblob' ? output.source.bytesSize?.toLocaleString() : '(remote)'} bytes,
                        {' '}
                        <Link onClick={() => handleShowContentInNewTab(output.source)}>
                          show <LaunchIcon sx={{ mx: 0.5, fontSize: 16 }} />
                        </Link>
                      </Typography>
                    );
                  } else if (output.atype === 'atext') {
                    return (
                      <Typography key={index} level='body-xs'>
                        🡒 txt: {output.text.length.toLocaleString()} bytes
                      </Typography>
                    );
                  } else {
                    return (
                      <Typography key={index} level='body-xs'>
                        🡒 {(output as any).atype}: (other)
                      </Typography>
                    );
                  }
                })
              )}
              {!!tokenCountApprox && (
                <Typography level='body-xs' sx={{ ml: 1.75 }}>
                  ~ {tokenCountApprox.toLocaleString()} tokens
                </Typography>
              )}
            </Box>
          </Box>
        </ListItem>
      )}
      {DEBUG_LLMATTACHMENTS && !!aInput && <ListDivider />}

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