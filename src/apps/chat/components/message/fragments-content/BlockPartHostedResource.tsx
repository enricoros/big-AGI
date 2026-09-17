import * as React from 'react';
import TimeAgo from 'react-timeago';
import { useQuery } from '@tanstack/react-query';

import { Checkbox, IconButton, ListItemDecorator, MenuItem, Sheet, Typography } from '@mui/joy';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';

import type { AnthropicAccessSchema } from '~/modules/llms/server/anthropic/anthropic.access';
import type { GeminiAccessSchema } from '~/modules/llms/server/gemini/gemini.access';
import type { OpenAIAccessSchema } from '~/modules/llms/server/openai/openai.access';
import { extractYoutubeVideoIDFromURL } from '~/modules/youtube/youtube.utils';
import { geminiFileDelete, geminiFileDownloadBlob, geminiFileErrorIsGone, geminiFileGetMetadata } from '~/modules/llms/vendors/gemini/geminiFiles.client';

import type { ContentScaling } from '~/common/app.theme';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { apiAsync, apiQuery } from '~/common/util/trpc.client';
import { convert_Base64_To_UInt8Array } from '~/common/util/blobUtils';
import { createHostedResourceContentFragment, createTextContentFragment, DMessageContentFragment, DMessageFragmentId, DMessageHostedResourcePart } from '~/common/stores/chat/chat.fragments';
import { copyBlobPromiseToClipboard, copyToClipboard } from '~/common/util/clipboardUtils';
import { downloadBlob } from '~/common/util/downloadUtils';
import { videoPlayObjectUrl } from '~/common/util/video/videoPlayManaged';
import { humanReadableBytes } from '~/common/util/textUtils';
import { guessMimeTypeFromFilename, mimeTypeIsPlainText, mimeTypeIsSupportedImage } from '~/common/attachment-drafts/attachment.mimetypes';
import { useAIPreferencesStore } from '~/common/stores/store-ai';
import { useLlmServiceAccess } from '~/common/stores/llms/hooks/useLlmServiceAccess';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import { HostedFileChip, HostedFileChipBusy, HostedFileChipButton } from './HostedFileChip';


// -- react-query enrichers - stable select functions --

function _enrichMetadataWithMimeFlags<T extends { mime_type: string }>(meta: T) {
  return {
    ...meta,
    mimeIsText: mimeTypeIsPlainText(meta.mime_type),
    mimeIsImage: mimeTypeIsSupportedImage(meta.mime_type),
  };
}

// The download routes pass the provider's content-type through, 'application/octet-stream' when absent. OpenAI's
// container files endpoint sends no content-type at all (only a content-disposition with the filename), so a generic
// header defers to the filename extension, while a specific header wins over it. Parameters ('; charset=utf-8') are
// dropped: the lookup tables key on the bare type.
function _resolveDownloadedMimeType(httpMimeType: string, filename: string): string {
  const headerMimeType = httpMimeType.split(';')[0].trim().toLowerCase();
  if (headerMimeType && headerMimeType !== 'application/octet-stream') return headerMimeType;
  return guessMimeTypeFromFilename(filename) || 'application/octet-stream';
}

type TDownloadedFile = { base64Data: string; mimeType: string };

function _base64ResponseToBlob({ base64Data, mimeType: httpMimeType }: TDownloadedFile, filename: string) {
  const bytes = convert_Base64_To_UInt8Array(base64Data, 'hosted-resource-ant-file');
  const mimeType = _resolveDownloadedMimeType(httpMimeType, filename);
  return {
    blob: new Blob([bytes], { type: mimeType }),
    mimeType,
    mimeIsText: mimeTypeIsPlainText(mimeType),
    mimeIsImage: mimeTypeIsSupportedImage(mimeType),
  };
}


// tRPC client error for an upstream 404: the provider no longer has the file (deleted, or its container expired)
function _errorIsNotFound(error: unknown): boolean {
  const data = (error as any)?.data;
  return !!data && (data.httpStatus === 404 || data.aixFHttpStatus === 404);
}


function AnthropicFileChip(props: {
  access: AnthropicAccessSchema,
  fileId: string,
  contentScaling: ContentScaling,
  onFragmentDelete?: () => void,
  onFragmentReplace?: (newFragment: DMessageContentFragment) => void,
}) {

  // state
  const [busy, setBusy] = React.useState<HostedFileChipBusy>(false);
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
  const fileName = metadata?.filename || fileId;
  const selectFileBlob = React.useCallback((response: TDownloadedFile) => _base64ResponseToBlob(response, fileName), [fileName]);
  const { data: fileContent, refetch: refetchFileContent } = apiQuery.llmAnthropic.fileApiDownload.useQuery({ access, fileId }, {
    enabled: false, // on-demand only
    select: selectFileBlob,
  });


  // derive display info from typed metadata
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
      if (data.mimeIsText)
        copyToClipboard(await data.blob.text(), fileName);
      else if (data.mimeIsImage)
        await copyBlobPromiseToClipboard(data.mimeType, Promise.resolve(data.blob), fileName);
      else
        setActionError('Cannot copy this file type');
    } catch (error: any) {
      setActionError(error?.message || 'Copy failed');
    } finally {
      setBusy(false);
    }
  }, [fileContent, refetchFileContent, fileName]);

  const handleDelete = React.useCallback(async () => {
    if (!onFragmentDelete) return;
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
  }, [access, fileId, onFragmentDelete]);


  const handleInline = React.useCallback(async () => {
    if (!onFragmentReplace) return;
    setBusy('inline');
    setActionError(null);
    try {
      const data = fileContent || (await refetchFileContent({ cancelRefetch: false, throwOnError: true })).data;
      if (!data) return;

      // text: inline as fenced code block
      if (data.mimeIsText) {
        const text = await data.blob.text();

        // fence with adaptive depth (extra backticks if content contains ```)
        let fence = '```';
        while (text.includes(fence) && fence.length < 10)
          fence += '`';
        onFragmentReplace(createTextContentFragment(`${fence}${fileName}\n${text}\n${fence}\n`));
      }
        // image: get dimensions, store in DBlob, and create a Zync asset reference
        // else if (data.mimeIsImage) {
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
        //       dataRef: createDMessageDataRefDBlob(dblobAssetId, data.mimeType, data.blob.size),
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
  const isFileGone = _errorIsNotFound(metaError);


  return (
    <HostedFileChip
      title={metaLoading ? 'Loading...' : isFileGone ? `${fileId} - file no longer available` : displayName}
      subtitle={metadata && <>{humanReadableBytes(metadata.size_bytes)} · <TimeAgo date={metadata.created_at} /> · {metadata.mime_type}</>}
      error={actionError || (metaError && !isFileGone ? (metaError.message || 'Could not load file info') : null)}
      busy={busy}
      disabled={isBusy}
      gone={isFileGone}
      onCopy={canCopy ? handleCopy : undefined}
      onDownload={handleDownload}
      onInline={onFragmentReplace ? handleInline : undefined}
      canInline={canInline}
      menuExtras={!autoEmbedEnabled && (
        // Auto-embed toggle - shared global preference
        <MenuItem disabled={!canInline || isBusy} onClick={handleToggleAutoEmbed}>
          <ListItemDecorator><Checkbox checked={autoEmbedEnabled} readOnly color='neutral' /></ListItemDecorator>
          <div>
            Always embed
            <Typography level='body-xs' sx={{ opacity: 0.6 }}>
              Change anytime in Settings
            </Typography>
          </div>
        </MenuItem>
      )}
      onDelete={onFragmentDelete ? handleDelete : undefined}
      deleteFrom='Anthropic'
      onRemove={onFragmentDelete}
    />
  );
}

function OpenAIContainerFileChip(props: {
  access: OpenAIAccessSchema,
  containerId: string,
  fileId: string,
  filename?: string,
  onFragmentDelete?: () => void,
  onFragmentReplace?: (newFragment: DMessageContentFragment) => void,
}) {

  // state
  const [busy, setBusy] = React.useState<HostedFileChipBusy>(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [fileGone, setFileGone] = React.useState(false); // learned from an action's 404: containers expire 20 minutes after their last use

  // props
  const { access, containerId, fileId, filename, onFragmentDelete, onFragmentReplace } = props;

  // no metadata endpoint: the citation filename is the only pre-download signal, and it names the downloaded blob's type
  const fileName = filename || fileId;
  const fileMimeType = guessMimeTypeFromFilename(fileName);

  // external state - download on-demand
  const selectFileBlob = React.useCallback((response: TDownloadedFile) => _base64ResponseToBlob(response, fileName), [fileName]);
  const { data: fileContent, refetch: refetchFileContent } = apiQuery.llmOpenAI.containerFileDownload.useQuery({ access, containerId, fileId }, {
    enabled: false, // on-demand only
    select: selectFileBlob,
  });

  // derive display info
  const displayName = fileName.length > 40 ? fileName.slice(0, 20) + '...' + fileName.slice(-15) : fileName;


  // handlers

  const handleDownload = React.useCallback(async () => {
    setBusy('download');
    setActionError(null);
    try {
      const data = fileContent || (await refetchFileContent({ cancelRefetch: false, throwOnError: true })).data;
      data && downloadBlob(data.blob, fileName);
    } catch (error: any) {
      _errorIsNotFound(error) ? setFileGone(true) : setActionError(error?.message || 'Download failed');
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
      if (data.mimeIsText)
        copyToClipboard(await data.blob.text(), fileName);
      else if (data.mimeIsImage)
        await copyBlobPromiseToClipboard(data.mimeType, Promise.resolve(data.blob), fileName);
      else
        setActionError('Cannot copy this file type');
    } catch (error: any) {
      _errorIsNotFound(error) ? setFileGone(true) : setActionError(error?.message || 'Copy failed');
    } finally {
      setBusy(false);
    }
  }, [fileContent, refetchFileContent, fileName]);

  const handleInline = React.useCallback(async () => {
    if (!onFragmentReplace) return;
    setBusy('inline');
    setActionError(null);
    try {
      const data = fileContent || (await refetchFileContent({ cancelRefetch: false, throwOnError: true })).data;
      if (!data) return;
      // backstop the extension gate with the real downloaded content-type
      if (!data.mimeIsText) {
        setActionError('Cannot embed this file type');
        return;
      }
      const text = await data.blob.text();
      // adaptive fence depth (extra backticks if the content itself contains ```)
      let fence = '```';
      while (text.includes(fence) && fence.length < 10) fence += '`';
      onFragmentReplace(createTextContentFragment(`${fence}${fileName}\n${text}\n${fence}\n`));
    } catch (error: any) {
      _errorIsNotFound(error) ? setFileGone(true) : setActionError(error?.message || 'Embed failed');
    } finally {
      setBusy(false);
    }
  }, [fileContent, refetchFileContent, fileName, onFragmentReplace]);


  const handleDelete = React.useCallback(async () => {
    if (!onFragmentDelete) return;
    setBusy('delete');
    setActionError(null);
    try {
      // remote deletion (the route reports an expired container as already gone, which is the same outcome)
      await apiAsync.llmOpenAI.containerFileDelete.mutate({ access, containerId, fileId });
      // fragment removal
      onFragmentDelete();
    } catch (error: any) {
      setActionError(error?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  }, [access, containerId, fileId, onFragmentDelete]);


  const isBusy = !!busy;
  const canCopy = !!fileMimeType && (mimeTypeIsPlainText(fileMimeType) || mimeTypeIsSupportedImage(fileMimeType));
  const canInline = !!onFragmentReplace && !!fileMimeType && mimeTypeIsPlainText(fileMimeType);

  return (
    <HostedFileChip
      title={fileGone ? <>{displayName} <span style={{ color: 'var(--joy-palette-warning-plainColor)' }}>- container expired</span></> : displayName}
      tooltip='OpenAI container file'
      error={actionError}
      busy={busy}
      gone={fileGone}
      onCopy={canCopy ? handleCopy : undefined}
      onDownload={handleDownload}
      onInline={onFragmentReplace ? handleInline : undefined}
      canInline={canInline}
      onDelete={onFragmentDelete ? handleDelete : undefined}
      deleteFrom='OpenAI'
      onRemove={onFragmentDelete}
    />
  );
}


function GeminiFileChip(props: {
  access: GeminiAccessSchema,
  fileName: string,
  mimeType: string,
  isVideo: boolean,
  onFragmentDelete?: () => void,
}) {

  // state
  const [busy, setBusy] = React.useState<HostedFileChipBusy>(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // props
  const { access, fileName, mimeType, isVideo, onFragmentDelete } = props;

  // external state - metadata (size/expiry/state). CSF-aware: fetches Google directly when access.clientSideFetch is
  // set (key stays client-side), else via the key-proxied tRPC route - see geminiFiles.client.ts. Keyed per
  // {host, fileName} (fileName is globally unique), so switching chats hits cache with no reload.
  const { data: metadata, isLoading: metaLoading, error: metaError } = useQuery({
    queryKey: ['gemini-file-metadata', access.geminiHost, fileName],
    queryFn: () => geminiFileGetMetadata(access, fileName),
    staleTime: Infinity, // metadata (size/expiry) is immutable once ACTIVE -> never refetch
    // the file reports PROCESSING right after generation and flips to ACTIVE within a few seconds - poll ONLY until
    // then so the 'processing…' label clears itself; at ACTIVE the interval returns false and staleTime:Infinity keeps it quiet forever
    refetchInterval: (query) => (query.state.data?.state === 'PROCESSING' ? 3000 : false),
  });

  // derived
  const shortId = fileName.replace(/^files\//, '');
  const ext = mimeType.split(';')[0].trim().split('/')[1] || 'bin';
  const downloadName = `gemini-${shortId}.${ext}`;
  const displayName = isVideo ? 'Gemini Generated Video' : 'Generated file';
  const isFileGone = geminiFileErrorIsGone(metaError);
  const isProcessing = metadata?.state === 'PROCESSING';
  const isBusy = !!busy || metaLoading;


  // handlers

  const getBlob = React.useCallback(() => geminiFileDownloadBlob(access, fileName), [access, fileName]);

  const handleDownload = React.useCallback(async () => {
    setBusy('download');
    setActionError(null);
    try {
      const blob = await getBlob();
      blob && downloadBlob(blob, downloadName);
    } catch (error: any) {
      setActionError(error?.message || 'Download failed');
    } finally {
      setBusy(false);
    }
  }, [getBlob, downloadName]);

  const handlePlay = React.useCallback(async () => {
    setBusy('play');
    setActionError(null);
    try {
      const blob = await getBlob();
      // reuse the ephemeral fullscreen overlay (revokes the object URL on close) - same playback as inline video
      blob && videoPlayObjectUrl(URL.createObjectURL(blob), 'AI Video');
    } catch (error: any) {
      setActionError(error?.message || 'Play failed');
    } finally {
      setBusy(false);
    }
  }, [getBlob]);

  const handleDelete = React.useCallback(() => {
    if (!onFragmentDelete) return;
    setBusy('delete');
    // best-effort remote delete (CSF-aware; a 404 just means it already expired), then drop the fragment
    geminiFileDelete(access, fileName).catch(console.error);
    onFragmentDelete();
  }, [access, fileName, onFragmentDelete]);


  return (
    <HostedFileChip
      title={metaLoading ? 'Loading...' : isFileGone ? 'Video no longer available (expired)' : displayName}
      subtitle={metadata && !isFileGone && <>
        {humanReadableBytes(metadata.sizeBytes)}
        {metadata.expirationTime && <> · expires <TimeAgo date={metadata.expirationTime} /></>}
        {isProcessing && ' · processing…'}
      </>}
      error={actionError || (metaError && !isFileGone ? 'Could not load file info' : null)}
      busy={busy}
      disabled={isBusy}
      gone={isFileGone}
      leading={isVideo && <HostedFileChipButton title='Play' icon={<PlayArrowRoundedIcon sx={{ fontSize: 'lg' }} />} busy={busy === 'play'} disabled={isBusy} onClick={handlePlay} />}
      onDownload={handleDownload}
      onDelete={onFragmentDelete ? handleDelete : undefined}
      deleteFrom='Google'
      onRemove={onFragmentDelete}
    />
  );
}


/** URL-referenced video (user-added, e.g. YouTube): provider-fetched, so no credentials or download - a link-out card. */
function UrlVideoChip(props: {
  url: string,
  muted: boolean,
  onToggleMuted?: () => void,
  onFragmentDelete?: () => void,
}) {
  const { muted } = props;
  const youTubeVideoId = extractYoutubeVideoIDFromURL(props.url);
  return (
    <Sheet variant='outlined' sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: 'sm', maxWidth: '100%' }}>

      {youTubeVideoId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://i.ytimg.com/vi/${youTubeVideoId}/default.jpg`} alt='Video' style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 4, flexShrink: 0, ...(muted && { opacity: 0.4, filter: 'grayscale(1)' }) }} />
      ) : (
        <PlayArrowRoundedIcon sx={{ fontSize: 'xl2', color: 'primary.solidBg', ...(muted && { opacity: 0.4 }) }} />
      )}

      <GoodTooltip title={(muted ? 'Video muted' : 'Video shared with the AI') + ' - open in a new tab'}>
        <Typography
          level='body-sm' component='a' href={props.url} target='_blank' rel='noopener noreferrer'
          sx={{ minWidth: 0, textDecoration: 'none', ...(muted && { opacity: 0.5 }), '&:hover': { textDecoration: 'underline' } }}
        >
          {props.url.replace(/^https?:\/\/(www\.)?/, '')}
        </Typography>
      </GoodTooltip>

      {!!props.onToggleMuted && (
        <GoodTooltip title={muted ? 'Muted: not sent to the AI - click to unmute' : 'Sent with every message - click to mute'}>
          <IconButton size='sm' variant={muted ? 'solid' : 'plain'} color={muted ? 'warning' : undefined} onClick={props.onToggleMuted}>
            {muted ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
          </IconButton>
        </GoodTooltip>
      )}

      {!!props.onFragmentDelete && (
        <IconButton size='sm' onClick={props.onFragmentDelete}>
          <DeleteOutlineIcon />
        </IconButton>
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
  isEditingMessage?: boolean,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
  onFragmentReplace?: (fragmentId: DMessageFragmentId, newFragment: DMessageContentFragment) => void,
}) {

  const { muted, resource } = props.hostedResourcePart;
  const { fragmentId, onFragmentDelete, onFragmentReplace } = props;

  const handleFragmentDelete = React.useCallback(() => {
    onFragmentDelete?.(fragmentId);
  }, [fragmentId, onFragmentDelete]);

  const handleFragmentReplace = React.useCallback((newFragment: DMessageContentFragment) => {
    onFragmentReplace?.(fragmentId, newFragment);
  }, [fragmentId, onFragmentReplace]);

  const handleToggleMuted = React.useCallback(() => {
    // same-fId replace: identical content, flipped muted state - keeps the fragment identity stable
    onFragmentReplace?.(fragmentId, { ...createHostedResourceContentFragment(resource, !muted), fId: fragmentId });
  }, [fragmentId, muted, onFragmentReplace, resource]);

  // reactive service + access resolution (hooks must run unconditionally - gated by the resolved 'via')
  const antAccess = useLlmServiceAccess(resource.via === 'anthropic' ? props.messageGeneratorLlmId : undefined, 'anthropic');
  const oaiAccess = useLlmServiceAccess(resource.via === 'openai-container' ? props.messageGeneratorLlmId : undefined, 'openai');
  const gemAccess = useLlmServiceAccess(resource.via === 'gemini-file' ? props.messageGeneratorLlmId : undefined, 'googleai');

  // URL-referenced media: public URL, no credentials involved
  if (resource.via === 'url')
    return (
      <UrlVideoChip
        url={resource.url}
        muted={!!muted}
        onToggleMuted={onFragmentReplace ? handleToggleMuted : undefined}
        // mute is the quick control; delete only while editing the message
        onFragmentDelete={(onFragmentDelete && props.isEditingMessage) ? handleFragmentDelete : undefined}
      />
    );

  if (resource.via === 'anthropic' && antAccess)
    return (
      <AnthropicFileChip
        access={antAccess}
        fileId={resource.fileId}
        contentScaling={props.contentScaling}
        onFragmentDelete={onFragmentDelete ? handleFragmentDelete : undefined}
        onFragmentReplace={onFragmentReplace ? handleFragmentReplace : undefined}
      />
    );

  if (resource.via === 'openai-container' && oaiAccess)
    return (
      <OpenAIContainerFileChip
        access={oaiAccess}
        containerId={resource.containerId}
        fileId={resource.fileId}
        filename={resource.filename}
        onFragmentDelete={onFragmentDelete ? handleFragmentDelete : undefined}
        onFragmentReplace={onFragmentReplace ? handleFragmentReplace : undefined}
      />
    );

  if (resource.via === 'gemini-file' && gemAccess)
    return (
      <GeminiFileChip
        access={gemAccess}
        fileName={resource.fileName}
        mimeType={resource.mimeType}
        isVideo={!!resource.isVideo}
        onFragmentDelete={onFragmentDelete ? handleFragmentDelete : undefined}
      />
    );

  const fallbackLabel = !resource ? 'unknown' : 'fileId' in resource ? resource.fileId : 'fileName' in resource ? resource.fileName : 'unknown';
  return <NoAccessChip fileId={fallbackLabel} />;
}
