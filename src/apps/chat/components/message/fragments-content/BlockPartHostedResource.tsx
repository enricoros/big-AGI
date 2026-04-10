import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, Checkbox, CircularProgress, Dropdown, IconButton, ListDivider, ListItemDecorator, Menu, MenuButton, MenuItem, Sheet, Typography } from '@mui/joy';
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
import { createTextContentFragment, DMessageContentFragment, DMessageFragmentId, DMessageHostedResourcePart } from '~/common/stores/chat/chat.fragments';
import { copyBlobPromiseToClipboard, copyToClipboard } from '~/common/util/clipboardUtils';
import { downloadBlob } from '~/common/util/downloadUtils';
import { humanReadableBytes } from '~/common/util/textUtils';
import { mimeTypeIsPlainText, mimeTypeIsSupportedImage } from '~/common/attachment-drafts/attachment.mimetypes';
import { useAIPreferencesStore } from '~/common/stores/store-ai';
import { useLlmServiceAccess } from '~/common/stores/llms/hooks/useLlmServiceAccess';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';


// -- react-query enrichers - stable select functions --

function _enrichMetadataWithMimeFlags<T extends { mime_type: string }>(meta: T) {
  return {
    ...meta,
    mimeIsText: mimeTypeIsPlainText(meta.mime_type),
    mimeIsImage: mimeTypeIsSupportedImage(meta.mime_type),
  };
}

function _base64ResponseToBlob({ base64Data, mimeType }: { base64Data: string; mimeType: string }) {
  const bytes = convert_Base64_To_UInt8Array(base64Data, 'hosted-resource-ant-file');
  return {
    blob: new Blob([bytes], { type: mimeType }),
    httpMimeType: mimeType,
    httpMimeIsText: mimeTypeIsPlainText(mimeType),
    httpMimeIsImage: mimeTypeIsSupportedImage(mimeType),
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
  const autoEmbedEnabled = useAIPreferencesStore(state => state.vndAntInlineFiles !== 'off');
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


  // handlers

  const handleDownload = React.useCallback(async () => {
    setBusy('download');
    setActionError(null);
    try {
      const data = fileContent || (await refetchFileContent({ cancelRefetch: false, throwOnError: true })).data;
      data && downloadBlob(data.blob, fileName);
    } catch (error: any) {
      setActionError(error?.message || 'Download failed');
    } finally {
      setBusy(false);
    }
  }, [fileContent, refetchFileContent, fileName]);

  const handleCopy = React.useCallback(async () => {
    setBusy('copy');
    setActionError(null);
    try {
      const data = fileContent || (await refetchFileContent({ cancelRefetch: false, throwOnError: true })).data;
      if (!data) return;
      if (data.httpMimeIsText)
        copyToClipboard(await data.blob.text(), fileName);
      else
        copyBlobPromiseToClipboard(data.httpMimeType, Promise.resolve(data.blob), fileName);
    } catch (error: any) {
      setActionError(error?.message || 'Copy failed');
    } finally {
      setBusy(false);
    }
  }, [fileContent, refetchFileContent, fileName]);

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
      const data = fileContent || (await refetchFileContent({ cancelRefetch: false, throwOnError: true })).data;
      if (!data) return;

      // text: inline as fenced code block
      if (data.httpMimeIsText) {
        const text = await data.blob.text();

        // fence with adaptive depth (extra backticks if content contains ```)
        let fence = '```';
        while (text.includes(fence) && fence.length < 10)
          fence += '`';
        onFragmentReplace(createTextContentFragment(`${fence}${fileName}\n${text}\n${fence}\n`));
      }
        // image: get dimensions, store in DBlob, and create a Zync asset reference
        // else if (data.httpMimeIsImage) {
        //
        //   const { width, height } = await imageBlobGetDimensions(data.blob).catch(() => ({ width: 0, height: 0 }));
        //
        //   const dblobAssetId = await addDBImageAsset('app-chat', data.blob, {
        //     label: fileName,
        //     origin: { ot: 'generated', source: 'ai-text-to-image', generatorName: 'anthropic-code-execution', prompt: '', parameters: {}, generatedAt: new Date().toISOString() },
        //     metadata: { width, height },
        //   });
        //
        //   onFragmentReplace(createZyncAssetReferenceContentFragment(
        //     nanoidToUuidV4(dblobAssetId, 'convert-dblob-to-dasset'),
        //     fileName,
        //     'image',
        //     {
        //       pt: 'image_ref',
        //       dataRef: createDMessageDataRefDBlob(dblobAssetId, data.httpMimeType, data.blob.size),
        //       ...(fileName ? { altText: fileName } : {}),
        //       ...(width ? { width } : {}),
        //       ...(height ? { height } : {}),
        //     },
        //   ));
      // }
      else
        return setActionError('Cannot inline this file type');

      // fire-and-forget: delete from provider
      apiAsync.llmAnthropic.fileApiDelete.mutate({ access, fileId }).catch(console.error);
    } catch (error: any) {
      setActionError(error?.message || 'Inline failed');
    } finally {
      setBusy(false);
    }
  }, [fileContent, refetchFileContent, access, fileId, fileName, onFragmentReplace]);


  const handleToggleAutoEmbed = React.useCallback(async () => {
    if (autoEmbedEnabled)
      return useAIPreferencesStore.getState().setVndAntInlineFiles('off');
    if (await showPromisedOverlay('chat-message-auto-embed-notice', { rejectWithValue: false }, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        noTitleBar
        lowStakes
        confirmationText={<>
          From now on, files generated by Claude tools (code execution, etc.) will be automatically downloaded and embedded into messages, then removed from Anthropic&apos;s File API.
          <br /><br />
          You can change this anytime in <b>Settings &gt; Chat AI &gt; Anthropic File Inlining</b>.
        </>}
        positiveActionText='Enable & Embed'
        negativeActionText='Cancel'
      />,
    )) {
      useAIPreferencesStore.getState().setVndAntInlineFiles('inline-file-and-delete');
      await handleInline();
    }
  }, [autoEmbedEnabled, handleInline, showPromisedOverlay]);


  const canCopy = !!metadata?.mimeIsText || !!metadata?.mimeIsImage;
  const canInline = !!onFragmentReplace && !!metadata?.mimeIsText; // for images, replace with ... && canCopy

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

        {canCopy && (
          <GoodTooltip title='Copy to clipboard'>
            <IconButton variant='soft' color='primary' disabled={isBusy} onClick={handleCopy} size='sm'>
              {busy === 'copy' ? <CircularProgress size='sm' /> : <ContentCopyIcon sx={{ fontSize: 'lg' }} />}
            </IconButton>
          </GoodTooltip>
        )}
        {/*{canInline && (*/}
        {/*  <GoodTooltip title='Embed in chat'>*/}
        {/*    <IconButton variant='soft' color='primary' disabled={isBusy} onClick={handleInline} size='sm'>*/}
        {/*      {busy === 'inline' ? <CircularProgress size='sm' /> : <VerticalAlignBottomIcon sx={{ fontSize: 'lg' }} />}*/}
        {/*    </IconButton>*/}
        {/*  </GoodTooltip>*/}
        {/*)}*/}
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
            <Menu placement='bottom-end' sx={{ minWidth: 220 }}>
              {/* Inline as doc attachment */}
              <MenuItem disabled={!canInline || isBusy} onClick={handleInline}>
                <ListItemDecorator><VerticalAlignBottomIcon /></ListItemDecorator>
                <div>
                  Embed
                  {!canInline && <Typography level='body-xs' sx={{ opacity: 0.6 }}>
                    File type not supported
                  </Typography>}
                </div>
              </MenuItem>
              {/* Auto-embed toggle - shared global preference */}
              {!autoEmbedEnabled && <>
                <MenuItem disabled={!canInline || isBusy} onClick={handleToggleAutoEmbed}>
                  <ListItemDecorator><Checkbox checked={autoEmbedEnabled} readOnly color='neutral' /></ListItemDecorator>
                  <div>
                    Always embed
                    <Typography level='body-xs' sx={{ opacity: 0.6 }}>
                      Change anytime in Settings
                    </Typography>
                  </div>
                </MenuItem>
              </>}
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
