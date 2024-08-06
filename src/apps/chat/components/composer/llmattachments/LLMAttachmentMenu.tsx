import * as React from 'react';

import { Box, Checkbox, CircularProgress, LinearProgress, Link, ListDivider, ListItem, ListItemDecorator, MenuItem, Radio, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import LaunchIcon from '@mui/icons-material/Launch';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

import { showImageDataRefInNewTab } from '~/modules/blocks/image/RenderImageRefDBlob';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { DMessageAttachmentFragment, isDocPart, isImageRefPart } from '~/common/stores/chat/chat.fragments';
import { LiveFileIcon } from '~/common/livefile/liveFile.icons';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { showImageDataURLInNewTab } from '~/common/util/imageUtils';

import type { AttachmentDraftId } from '~/common/attachment-drafts/attachment.types';
import type { AttachmentDraftsStoreApi } from '~/common/attachment-drafts/store-attachment-drafts-slice';
import type { LLMAttachmentDraft } from './useLLMAttachmentDrafts';
import type { LLMAttachmentDraftsAction } from './LLMAttachmentsList';


// configuration
const DEFAULT_DETAILS_OPEN = true;
const SHOW_INLINING_OPERATIONS = false;


export function LLMAttachmentMenu(props: {
  attachmentDraftsStoreApi: AttachmentDraftsStoreApi,
  llmAttachmentDraft: LLMAttachmentDraft,
  menuAnchor: HTMLAnchorElement,
  isPositionFirst: boolean,
  isPositionLast: boolean,
  onDraftAction: (attachmentDraftId: AttachmentDraftId, actionId: LLMAttachmentDraftsAction) => void,
  onClose: () => void,
}) {

  // state
  const [showDetails, setShowDetails] = React.useState(DEFAULT_DETAILS_OPEN);

  // derived state

  const {
    attachmentDraft: draft,
    llmSupportsTextFragments,
    llmTokenCountApprox,
  } = props.llmAttachmentDraft;

  const draftId = draft.id;
  const draftSource = draft.source;
  const draftInput = draft.input;
  const isConverting = draft.outputsConverting;
  const isUnconvertible = !draft.converters.length;
  const isOutputMissing = !draft.outputFragments.length;
  const hasLiveFiles = draft.outputFragments.some(_f => _f.liveFileId);

  const isUnmoveable = props.isPositionFirst && props.isPositionLast;


  // hooks

  const handleToggleShowDetails = React.useCallback(() => {
    setShowDetails(on => !on);
  }, []);


  // operations

  const { attachmentDraftsStoreApi, onDraftAction, onClose } = props;

  const handleMoveUp = React.useCallback(() => {
    attachmentDraftsStoreApi.getState().moveAttachmentDraft(draftId, -1);
  }, [draftId, attachmentDraftsStoreApi]);

  const handleMoveDown = React.useCallback(() => {
    attachmentDraftsStoreApi.getState().moveAttachmentDraft(draftId, 1);
  }, [draftId, attachmentDraftsStoreApi]);

  const handleRemove = React.useCallback(() => {
    onClose();
    attachmentDraftsStoreApi.getState().removeAttachmentDraft(draftId);
  }, [draftId, attachmentDraftsStoreApi, onClose]);

  const handleSetConverterIdx = React.useCallback(async (converterIdx: number | null) => {
    return attachmentDraftsStoreApi.getState().toggleAttachmentDraftConverterAndConvert(draftId, converterIdx);
  }, [draftId, attachmentDraftsStoreApi]);

  // const handleSummarizeText = React.useCallback(() => {
  //   onAttachmentDraftSummarizeText(draftId);
  // }, [draftId, onAttachmentDraftSummarizeText]);

  const canHaveDetails = !!draftInput && !isConverting;

  return (
    <CloseableMenu
      dense placement='top'
      noTopPadding
      open anchorEl={props.menuAnchor} onClose={props.onClose}
      sx={{ minWidth: 260 }}
    >

      {/* Move Arrows */}
      {!isUnmoveable && <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
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

      {/*{(showDetails && canHaveDetails) && <ListItem variant='soft' sx={{ fontSize: 'sm', borderBottom: '1px solid', borderColor: 'divider' }}>*/}
      {/*  {draft.ref}*/}
      {/*</ListItem>}*/}

      {/* Render Converters as menu items */}
      {!isUnconvertible && (
        <ListItem sx={{ fontSize: 'sm', my: 0.75 }}>
          Attach {draftSource.media === 'url' ? 'web page'
          : draftSource.media === 'file' ? 'file'
            : draftSource.media === 'text'
              ? (draftSource.method === 'drop' ? 'drop' : draftSource.method === 'clipboard-read' ? 'clipboard' : draftSource.method === 'paste' ? 'paste' : '')
              : ''} as:
        </ListItem>
      )}
      {!isUnconvertible && draft.converters.map((c, idx) =>
        <MenuItem
          disabled={c.disabled || isConverting}
          key={'c-' + c.id}
          onClick={async () => (c.isCheckbox || !c.isActive) && await handleSetConverterIdx(idx)}
        >
          <ListItemDecorator>
            {(isConverting && c.isActive)
              ? <CircularProgress size='sm' sx={{ '--CircularProgress-size': '1.25rem' }} />
              : !c.isCheckbox
                ? <Radio key={'rd-' + idx} checked={c.isActive} disabled={isConverting} />
                : <Checkbox key={'cb-' + idx} checked={c.isActive === true} disabled={isConverting} />
            }
          </ListItemDecorator>
          {c.unsupported
            ? <Box>Unsupported 🤔 <Typography level='body-xs'>{c.name}</Typography></Box>
            : c.name}
        </MenuItem>,
      )}
      {/*{!isUnconvertible && <ListDivider sx={{ mb: 0 }} />}*/}

      {/* Progress indicator (mainly for OCRs of Images, PDFs, and PDF to Images) */}
      {!!draft.outputsConversionProgress && draft.outputsConversionProgress < 1 && (
        <LinearProgress determinate value={100 * draft.outputsConversionProgress} sx={{ mx: 1 }} />
      )}

      <MenuItem
        variant='soft'
        color={isOutputMissing ? 'warning' : 'success'}
        disabled={!canHaveDetails}
        onClick={handleToggleShowDetails}
        sx={{
          my: 0.75,
          border: '1px solid',
          borderLeft: 'none',
          borderRight: 'none',
          borderColor: 'divider',
        }}
      >
        <ListItemDecorator>
          {(showDetails && canHaveDetails) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </ListItemDecorator>
        {!(showDetails && canHaveDetails) ? (
          <Typography sx={{ fontSize: 'sm' }}>
            Details
          </Typography>
        ) : (
          <Box sx={{ my: 0.5 }}>

            {/* <- inputs */}
            {!!draftInput && (
              <Typography level='body-sm'>
                🡐 {draftInput.mimeType}{typeof draftInput.dataSize === 'number' ? ` · ${draftInput.dataSize.toLocaleString()} bytes` : ''}
              </Typography>
            )}
            {!!draftInput?.altMimeType && (
              <Typography level='body-sm'>
                <span style={{ color: 'transparent' }}>🡐</span> {draftInput.altMimeType} · {draftInput.altData?.length.toLocaleString()}
              </Typography>
            )}
            {!!draftInput?.urlImage && (
              <Typography level='body-sm'>
                <span style={{ color: 'transparent' }}>🡐</span> {draftInput.urlImage.mimeType} · {draftInput.urlImage.width} x {draftInput.urlImage.height} · {draftInput.urlImage.imgDataUrl?.length.toLocaleString()}
                {' · '}
                <Link onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  showImageDataURLInNewTab(draftInput?.urlImage?.imgDataUrl || '');
                }}>
                  open <LaunchIcon sx={{ mx: 0.5, fontSize: 16 }} />
                </Link>
              </Typography>
            )}

            {/*<Typography level='body-sm'>*/}
            {/*  Converters: {draft.converters.map(((converter, idx) => ` ${converter.id}${converter.isActive ? '*' : ''}`)).join(', ')}*/}
            {/*</Typography>*/}

            {/* -> Outputs */}
            <Box sx={{ mt: 1 }}>
              {isOutputMissing ? (
                <Typography level='body-sm'>🡒 ...</Typography>
              ) : (
                draft.outputFragments.map(({ part }, index) => {
                  if (isImageRefPart(part)) {
                    const resolution = part.width && part.height ? `${part.width} x ${part.height}` : 'unknown resolution';
                    const mime = part.dataRef.reftype === 'dblob' ? part.dataRef.mimeType : 'unknown image';
                    return (
                      <Typography key={index} level='body-sm' sx={{ color: 'text.primary' }}>
                        🡒 {mime/*unic.replace('image/', 'img: ')*/} · {resolution} · {part.dataRef.reftype === 'dblob' ? part.dataRef.bytesSize?.toLocaleString() : '(remote)'}
                        {' · '}
                        <Link onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void showImageDataRefInNewTab(part.dataRef);
                        }}>
                          open <LaunchIcon sx={{ mx: 0.5, fontSize: 16 }} />
                        </Link>
                      </Typography>
                    );
                  } else if (isDocPart(part)) {
                    return (
                      <Typography key={index} level='body-sm' sx={{ color: 'text.primary' }}>
                        🡒 {part.data.mimeType /* part.type: big-agi type, not source mime */}: {part.data.text.length.toLocaleString()} bytes
                        {' · '}
                        <Link onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          copyToClipboard(part.data.text, 'Attachment Text');
                        }}>
                          copy <ContentCopyIcon sx={{ mx: 0.5, fontSize: 16 }} />
                        </Link>
                      </Typography>
                    );
                  } else {
                    return (
                      <Typography key={index} level='body-sm' sx={{ color: 'text.primary' }}>
                        🡒 {(part as DMessageAttachmentFragment['part']).pt}: (other)
                      </Typography>
                    );
                  }
                })
              )}
              {!!llmTokenCountApprox && (
                <Typography level='body-sm' sx={{ color: 'text.primary' }}>
                  <span style={{ marginLeft: 2 }}>=</span> {llmTokenCountApprox.toLocaleString()} tokens
                </Typography>
              )}
            </Box>

            {/* LiveFile notice */}
            {hasLiveFiles && !!draftInput && (
              <Typography level='body-sm' sx={{ mt: 1 }} startDecorator={<LiveFileIcon sx={{ width: 16, height: 16 }} />}>
                LiveFile is supported
              </Typography>
            )}

          </Box>
        )}
      </MenuItem>

      {/* Destructive Operations */}
      {/*<MenuItem onClick={handleCopyToClipboard} disabled={!isOutputTextInlineable}>*/}
      {/*  <ListItemDecorator><ContentCopyIcon /></ListItemDecorator>*/}
      {/*  Copy*/}
      {/*</MenuItem>*/}
      {/*<MenuItem onClick={handleSummarizeText} disabled={!isOutputTextInlineable}>*/}
      {/*  <ListItemDecorator><CompressIcon color='success' /></ListItemDecorator>*/}
      {/*  Shrink*/}
      {/*</MenuItem>*/}

      {SHOW_INLINING_OPERATIONS && (
        <MenuItem onClick={() => onDraftAction(draftId, 'inline-text')} disabled={!llmSupportsTextFragments || isConverting}>
          <ListItemDecorator><VerticalAlignBottomIcon /></ListItemDecorator>
          Inline text
        </MenuItem>
      )}
      {SHOW_INLINING_OPERATIONS && (
        <MenuItem onClick={() => onDraftAction(draftId, 'copy-text')} disabled={!llmSupportsTextFragments || isConverting}>
          <ListItemDecorator><ContentCopyIcon /></ListItemDecorator>
          Copy text
        </MenuItem>
      )}
      {SHOW_INLINING_OPERATIONS && <ListDivider />}

      <MenuItem onClick={handleRemove}>
        <ListItemDecorator><ClearIcon /></ListItemDecorator>
        Remove
      </MenuItem>

    </CloseableMenu>
  );
}