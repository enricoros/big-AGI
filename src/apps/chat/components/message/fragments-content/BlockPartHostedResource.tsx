import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, CircularProgress, Dropdown, IconButton, ListDivider, ListItemDecorator, Menu, MenuButton, MenuItem, Sheet, Typography } from '@mui/joy';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

import type { AnthropicAccessSchema } from '~/modules/llms/server/anthropic/anthropic.access';

import type { ContentScaling } from '~/common/app.theme';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { apiAsync, apiQuery } from '~/common/util/trpc.client';
import { convert_Base64_To_UInt8Array } from '~/common/util/blobUtils';
import { copyBlobPromiseToClipboard, copyToClipboard } from '~/common/util/clipboardUtils';
import { createTextContentFragment, DMessageContentFragment, DMessageFragmentId, DMessageHostedResourcePart } from '~/common/stores/chat/chat.fragments';
import { downloadBlob } from '~/common/util/downloadUtils';
import { humanReadableBytes } from '~/common/util/textUtils';
import { imageBlobTransform } from '~/common/util/imageUtils';
import { mimeTypeIsPlainText } from '~/common/attachment-drafts/attachment.mimetypes';
import { useLlmServiceAccess } from '~/common/stores/llms/hooks/useLlmServiceAccess';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';


// -- react-query enrichers - stable select functions --

function _enrichMetadataWithMimeFlags<T extends { mime_type: string }>(meta: T) {
  return {
    ...meta,
    mimeIsText: mimeTypeIsPlainText(meta.mime_type),
    mimeIsImage: meta.mime_type.startsWith('image/'),
  };
}

function _base64ResponseToBlob({ base64Data, mimeType }: { base64Data: string; mimeType: string }) {
  const bytes = convert_Base64_To_UInt8Array(base64Data, 'hosted-resource-ant-file');
  return {
    blob: new Blob([bytes], { type: mimeType }),
    httpMimeType: mimeType,
    httpMimeIsText: mimeTypeIsPlainText(mimeType),
    httpMimeIsImage: mimeType.startsWith('image/'),
  };
}


function AnthropicFileChip(props: {
  access: AnthropicAccessSchema,
  fileId: string,
  contentScaling: ContentScaling,
  onFragmentDelete?: () => void,
  onFragmentReplace?: (newFragment: DMessageContentFragment) => void,
}) {

  // state
  const [busy, setBusy] = React.useState<false | 'download' | 'copy' | 'delete' | 'inline'>(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const { showPromisedOverlay } = useOverlayComponents();

  // props
  const { access, fileId, onFragmentDelete, onFragmentReplace } = props;

  // external state
  const { data: metadata, isLoading: metaLoading, error: metaError } = apiQuery.llmAnthropic.fileApiGetMetadata.useQuery({ access, fileId }, {
    staleTime: Infinity,
    select: _enrichMetadataWithMimeFlags,
  });
  const { data: fileContent, refetch: refetchFileContent } = apiQuery.llmAnthropic.fileApiDownload.useQuery({ access, fileId }, {
    enabled: false, // on-demand only
    select: _base64ResponseToBlob,
  });


  // derive display info from typed metadata
  const fileName = metadata?.filename || fileId;
  const displayName = fileName.length > 40 ? fileName.slice(0, 20) + '...' + fileName.slice(-15) : fileName;


  const _getOrFetchFileContent = React.useCallback(async () => {
    const content = fileContent ?? (await refetchFileContent()).data;
    if (!content) throw new Error('File download failed');
    return content;
  }, [fileContent, refetchFileContent]);


  const handleDownload = React.useCallback(async () => {
    setBusy('download');
    setActionError(null);
    try {
      const { blob } = await _getOrFetchFileContent();
      downloadBlob(blob, fileName);
    } catch (error: any) {
      setActionError(error?.message || 'Download failed');
    } finally {
      setBusy(false);
    }
  }, [_getOrFetchFileContent, fileName]);

  const handleCopy = React.useCallback(async () => {
    setBusy('copy');
    setActionError(null);
    try {
      const { blob, httpMimeIsImage } = await _getOrFetchFileContent();
      if (httpMimeIsImage) {
        // ClipboardItem only supports image/png - convert from jpeg/webp/gif/etc. if needed
        const pngBlob = blob.type === 'image/png' ? blob
          : (await imageBlobTransform(blob, { convertToMimeType: 'image/png', throwOnTypeConversionError: true })).blob;
        copyBlobPromiseToClipboard('image/png', Promise.resolve(pngBlob), fileName);
      } else {
        copyToClipboard(await blob.text(), fileName);
      }
    } catch (error: any) {
      setActionError(error?.message || 'Copy failed');
    } finally {
      setBusy(false);
    }
  }, [_getOrFetchFileContent, fileName]);

  const handleDelete = React.useCallback(async (event: React.MouseEvent) => {
    if (!onFragmentDelete) return;
    if (!event.shiftKey && !await showPromisedOverlay('chat-message-delete-hosted-resource', { rejectWithValue: false }, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        confirmationText={<>Delete &quot;{fileName}&quot; from Anthropic servers?<br />This action cannot be undone.</>}
        positiveActionText='Delete'
      />,
    )) return;
    setBusy('delete');
    setActionError(null);
    try {
      // remote deletion
      await apiAsync.llmAnthropic.fileApiDelete.mutate({ access, fileId });
      // fragment removal
      onFragmentDelete();
    } catch (error: any) {
      setActionError(error?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  }, [access, fileId, fileName, onFragmentDelete, showPromisedOverlay]);


  const handleInline = React.useCallback(async () => {
    if (!onFragmentReplace) return;
    setBusy('inline');
    setActionError(null);
    try {
      const { blob, httpMimeIsText } = await _getOrFetchFileContent();

      // only inline textual content
      if (!httpMimeIsText) {
        setActionError('Cannot inline binary file');
        return;
      }

      const text = await blob.text();

      // fence with adaptive depth (extra backticks if content contains ```)
      let fence = '```';
      while (text.includes(fence))
        fence += '`';
      const newFragment = createTextContentFragment(`${fence}${fileName}\n${text}\n${fence}\n`);
      onFragmentReplace(newFragment);

      // // doc attachment alternative (richer: title bar, edit, live file sync)
      // const isCode = mimeType !== 'text/plain';
      // const vdt = isCode ? DVMimeType.VndAgiCode : DVMimeType.TextPlain;
      // const newFragment = createDocAttachmentFragment(
      //   fileName, 'Inlined from hosted file', vdt,
      //   createDMessageDataInlineText(text, mimeType),
      //   fileName, 1,
      // );

      // fire-and-forget: delete from provider
      apiAsync.llmAnthropic.fileApiDelete.mutate({ access, fileId }).catch(() => {/* silent */
      });
    } catch (error: any) {
      setActionError(error?.message || 'Inline failed');
    } finally {
      setBusy(false);
    }
  }, [_getOrFetchFileContent, access, fileId, fileName, onFragmentReplace]);


  const canCopy = !!metadata && (metadata.mimeIsText || metadata.mimeIsImage);
  const canInline = !!onFragmentReplace && !!metadata?.mimeIsText;

  const isBusy = !!busy || metaLoading;
  const hasError = !!metaError || !!actionError;
  const isFileGone = !!metaError && typeof metaError === 'object' && 'data' in metaError && (metaError.data?.httpStatus === 404 || metaError.data?.aixFHttpStatus === 404);


  return (
    <Sheet
      variant='soft'
      color='primary'
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mx: 1.5,
        px: 1.125,
        py: 0.5,
        borderRadius: 'sm',
        overflow: 'hidden',
        maxWidth: '100%',
        boxShadow: 'inset 1px 2px 2px -2px rgba(0, 0, 0, 0.2)',
      }}
    >
      <AttachFileRoundedIcon sx={{ fontSize: 'lg', opacity: 0.5 }} />

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box className='agi-ellipsize' sx={{ fontSize: 'sm', fontWeight: 'md', color: hasError ? 'var(--joy-palette-danger-plainColor)' : undefined }}>
          {metaLoading ? 'Loading...' : isFileGone ? `${fileId} - file no longer available` : hasError ? `${displayName} - ${actionError || 'Could not load file info'}` : displayName}
        </Box>
        {metadata && (
          <Box sx={{ fontSize: 'xs', opacity: 0.6 }}>
            {humanReadableBytes(metadata.size_bytes)} · <TimeAgo date={metadata.created_at} /> · {metadata.mime_type}
          </Box>
        )}
      </Box>

      {!isFileGone ? <>

        <GoodTooltip title='Copy to clipboard'>
          <IconButton variant='soft' color='primary' disabled={isBusy || isFileGone || !canCopy} onClick={handleCopy} size='sm'>
            {busy === 'copy' ? <CircularProgress size='sm' /> : <ContentCopyIcon sx={{ fontSize: 'lg' }} />}
          </IconButton>
        </GoodTooltip>
        <GoodTooltip title='Download file'>
          <IconButton variant='soft' color='primary' disabled={isBusy || isFileGone} onClick={handleDownload} size='sm'>
            {busy === 'download' ? <CircularProgress size='sm' /> : <DownloadIcon sx={{ fontSize: 'lg' }} />}
          </IconButton>
        </GoodTooltip>
        {(onFragmentDelete || onFragmentReplace) && (
          <Dropdown>
            <MenuButton slots={{ root: IconButton }} slotProps={{ root: { variant: 'soft', color: 'primary', size: 'sm', disabled: isBusy && busy !== 'inline' } }}>
              {(busy === 'delete' || busy === 'inline') ? <CircularProgress size='sm' /> : <MoreVertIcon sx={{ fontSize: 'lg' }} />}
            </MenuButton>
            <Menu placement='bottom-end' sx={{ minWidth: 180 }}>
              {/* Inline as doc attachment */}
              <MenuItem disabled={!canInline || isBusy} onClick={handleInline}>
                <ListItemDecorator><VerticalAlignBottomIcon /></ListItemDecorator>
                Inline
              </MenuItem>
              {!!onFragmentDelete && <ListDivider />}
              {/* Delete from provider */}
              {!!onFragmentDelete && (
                <MenuItem color='danger' disabled={isBusy} onClick={handleDelete}>
                  <ListItemDecorator><DeleteOutlineIcon /></ListItemDecorator>
                  Delete
                </MenuItem>
              )}
            </Menu>
          </Dropdown>
        )}

      </> : onFragmentDelete && (
        <GoodTooltip title='Remove from message'>
          <IconButton variant='plain' color='danger' onClick={onFragmentDelete} size='sm'>
            <DeleteOutlineIcon sx={{ fontSize: 'lg' }} />
          </IconButton>
        </GoodTooltip>
      )}
    </Sheet>
  );
}

function NoAccessChip(props: { fileId: string }) {
  return (
    <Sheet variant='outlined' sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.5, borderRadius: 'sm' }}>
      <AttachFileRoundedIcon sx={{ fontSize: 'lg', opacity: 0.4 }} />
      <Typography level='body-sm' sx={{ opacity: 0.5 }}>
        {props.fileId} (no credentials)
      </Typography>
    </Sheet>
  );
}


export function BlockPartHostedResource(props: {
  hostedResourcePart: DMessageHostedResourcePart,
  fragmentId: DMessageFragmentId,
  messageGeneratorLlmId?: string | null,
  contentScaling: ContentScaling,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,
}) {

  const { resource } = props.hostedResourcePart;
  const { fragmentId, onFragmentDelete, onFragmentReplace } = props;

  const handleFragmentDelete = React.useCallback(() => {
    onFragmentDelete?.(fragmentId);
  }, [fragmentId, onFragmentDelete]);

  const handleFragmentReplace = React.useCallback((newFragment: DMessageContentFragment) => {
    onFragmentReplace?.(fragmentId, newFragment);
  }, [fragmentId, onFragmentReplace]);

  // TODO: OpenAI container_file_citation support (via: 'openai' with fileId + containerId)?

  // reactive service + access resolution
  const isAnthropic = resource.via === 'anthropic';
  const antAccess = useLlmServiceAccess(isAnthropic ? props.messageGeneratorLlmId : undefined, 'anthropic');

  // only support Anthropic files for now
  if (!isAnthropic || !antAccess)
    return <NoAccessChip fileId={resource?.fileId || 'unknown'} />;

  return (
    <AnthropicFileChip
      access={antAccess}
      fileId={resource.fileId}
      contentScaling={props.contentScaling}
      onFragmentDelete={onFragmentDelete ? handleFragmentDelete : undefined}
      onFragmentReplace={onFragmentReplace ? handleFragmentReplace : undefined}
    />
  );
}
