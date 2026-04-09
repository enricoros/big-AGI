// TODO: OpenAI container_file_citation support (via: 'openai' with fileId + containerId)
// TODO: click chip to preview text files inline (expand content, like doc attachments)
// TODO: download + store as Zync asset for local persistence (survives Anthropic file expiry/deletion)

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
import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';

import type { ContentScaling } from '~/common/app.theme';
import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DMessageContentFragment, DMessageFragmentId, DMessageHostedResourcePart } from '~/common/stores/chat/chat.fragments';
import { createTextContentFragment } from '~/common/stores/chat/chat.fragments';
import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { mimeTypeIsPlainText } from '~/common/attachment-drafts/attachment.mimetypes';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { apiAsync, apiQuery } from '~/common/util/trpc.client';
import { convert_Base64_To_UInt8Array } from '~/common/util/blobUtils';
import { copyBlobPromiseToClipboard, copyToClipboard } from '~/common/util/clipboardUtils';
import { downloadBlob } from '~/common/util/downloadUtils';
import { findModelsServiceOrNull, useModelsStore } from '~/common/stores/llms/store-llms';
import { humanReadableBytes } from '~/common/util/textUtils';
import { imageBlobTransform } from '~/common/util/imageUtils';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';


/**
 * Hook: reactively resolve the Anthropic service ID for file access.
 * Selects a stable string (service ID) so Zustand won't trigger re-render loops.
 * Prefers the generator's own service, falls back to the first available Anthropic service.
 */
function useAnthropicServiceId(generatorLlmId?: DLLMId): DModelsServiceId | null {
  return useModelsStore(({ llms, sources }) => {
    if (generatorLlmId) {
      const llm = llms.find(m => m.id === generatorLlmId);
      if (llm) {
        const service = findModelsServiceOrNull(llm.sId);
        if (service?.vId === 'anthropic')
          return service.id;
      }
    }
    return sources.find(s => s.vId === 'anthropic')?.id ?? null;
  });
}

/** Derive access credentials from a resolved service ID (non-reactive, called on-demand). */
function _accessFromServiceId(serviceId: DModelsServiceId): AnthropicAccessSchema | null {
  const vendor = findModelVendor<any, AnthropicAccessSchema>('anthropic');
  if (!vendor) return null;
  const service = findModelsServiceOrNull(serviceId);
  if (!service) return null;
  return vendor.getTransportAccess(service.setup);
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
  const { data: metadata, isLoading: metaLoading, error: metaError } = apiQuery.llmAnthropic.fileApiGetMetadata.useQuery(
    // metadata query - cached by React Query, staleTime: Infinity (file metadata is immutable)
    { access, fileId },
    { staleTime: Infinity },
  );


  // derive display info from typed metadata
  const fileName = metadata?.filename || fileId;
  const displayName = fileName.length > 40 ? fileName.slice(0, 20) + '...' + fileName.slice(-15) : fileName;


  // shared: fetch file content as { blob, mimeType }
  const _fetchFileBlob = React.useCallback(async (): Promise<{ blob: Blob, mimeType: string }> => {
    const { base64Data, mimeType } = await apiAsync.llmAnthropic.fileApiDownload.query({ access, fileId });
    const bytes = convert_Base64_To_UInt8Array(base64Data, 'hosted-resource-ant-file');
    return { blob: new Blob([bytes], { type: mimeType }), mimeType };
  }, [access, fileId]);


  const handleDownload = React.useCallback(async () => {
    setBusy('download');
    setActionError(null);
    try {
      const { blob } = await _fetchFileBlob();
      downloadBlob(blob, fileName);
    } catch (error: any) {
      setActionError(error?.message || 'Download failed');
    } finally {
      setBusy(false);
    }
  }, [_fetchFileBlob, fileName]);

  const handleCopy = React.useCallback(async () => {
    setBusy('copy');
    setActionError(null);
    try {
      const { blob, mimeType: blobMimeType } = await _fetchFileBlob();
      if (blobMimeType.startsWith('image/')) {
        // ClipboardItem only supports image/png - convert from jpeg/webp/gif/etc. if needed
        const pngBlob = blobMimeType === 'image/png' ? blob
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
  }, [_fetchFileBlob, fileName]);

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
      const { blob, mimeType } = await _fetchFileBlob();

      // only inline textual content
      if (!mimeTypeIsPlainText(mimeType)) {
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
  }, [_fetchFileBlob, access, fileId, fileName, onFragmentReplace]);


  const canInline = !!onFragmentReplace && !!metadata && mimeTypeIsPlainText(metadata.mime_type);

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
          <IconButton variant='soft' color='primary' disabled={isBusy || isFileGone} onClick={handleCopy} size='sm'>
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

  // reactive service resolution (stable string selector, no re-render loops)
  const serviceId = useAnthropicServiceId(resource.via === 'anthropic' ? (props.messageGeneratorLlmId ?? undefined) : undefined);

  // derive access credentials on-demand from the resolved service ID
  const access = React.useMemo(() => serviceId ? _accessFromServiceId(serviceId) : null, [serviceId]);

  // only support Anthropic files for now
  if (resource.via !== 'anthropic' || !access)
    return <NoAccessChip fileId={resource?.fileId || 'unknown'} />;

  return (
    <AnthropicFileChip
      access={access}
      fileId={resource.fileId}
      contentScaling={props.contentScaling}
      onFragmentDelete={onFragmentDelete ? handleFragmentDelete : undefined}
      onFragmentReplace={onFragmentReplace ? handleFragmentReplace : undefined}
    />
  );
}
