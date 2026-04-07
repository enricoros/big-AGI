import * as React from 'react';

import TimeAgo from 'react-timeago';

import { Box, CircularProgress, IconButton, Sheet, Typography } from '@mui/joy';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import DownloadIcon from '@mui/icons-material/Download';

import type { AnthropicAccessSchema } from '~/modules/llms/server/anthropic/anthropic.access';
import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';

import type { ContentScaling } from '~/common/app.theme';
import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DMessageHostedResourcePart } from '~/common/stores/chat/chat.fragments';
import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { apiAsync, apiQuery } from '~/common/util/trpc.client';
import { downloadBlob } from '~/common/util/downloadUtils';
import { findModelsServiceOrNull, useModelsStore } from '~/common/stores/llms/store-llms';
import { humanReadableBytes } from '~/common/util/textUtils';


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
}) {

  // state
  const [downloading, setDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  // props
  const { access, fileId } = props;

  // external state
  const { data: metadata, isLoading: metaLoading, error: metaError } = apiQuery.llmAnthropic.getFileMetadata.useQuery(
    // metadata query - cached by React Query, staleTime: Infinity (file metadata is immutable)
    { access, fileId },
    { staleTime: Infinity },
  );


  // derive display info from typed metadata
  const fileName = metadata?.filename || fileId;
  const displayName = fileName.length > 40 ? fileName.slice(0, 20) + '...' + fileName.slice(-15) : fileName;

  const handleDownload = React.useCallback(async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const { base64Data, mimeType } = await apiAsync.llmAnthropic.downloadFile.query({ access, fileId });
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++)
        bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType });
      downloadBlob(blob, fileName);
    } catch (error: any) {
      setDownloadError(error?.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  }, [access, fileId, fileName]);

  const hasError = !!metaError || !!downloadError;

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
          {metaLoading ? 'Loading...' : hasError ? `${displayName} - ${downloadError || 'Could not load file info'}` : displayName}
        </Box>
        {metadata && (
          <Box sx={{ fontSize: 'xs', opacity: 0.6 }}>
            {humanReadableBytes(metadata.size_bytes)} · <TimeAgo date={metadata.created_at} /> · {metadata.mime_type}
          </Box>
        )}
      </Box>
      <IconButton variant='soft' color='primary' disabled={downloading || metaLoading} onClick={handleDownload} sx={{ ml: 'auto' }}>
        {downloading ? <CircularProgress size='sm' /> : <DownloadIcon sx={{ fontSize: 'lg' }} />}
      </IconButton>
    </Sheet>
  );
}


export function BlockPartHostedResource(props: {
  hostedResourcePart: DMessageHostedResourcePart,
  messageGeneratorLlmId?: string | null,
  contentScaling: ContentScaling,
}) {

  const { resource } = props.hostedResourcePart;

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
    />
  );
}
