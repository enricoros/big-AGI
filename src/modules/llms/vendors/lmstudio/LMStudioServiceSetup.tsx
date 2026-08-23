import * as React from 'react';
import * as z from 'zod/v4';

import { Alert, Typography } from '@mui/joy';
import YouTubeIcon from '@mui/icons-material/YouTube';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { ExpanderAccordion } from '~/common/components/ExpanderAccordion';
import { ExternalDocsLink } from '~/common/components/ExternalDocsLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { isLocalUrl } from '~/common/util/urlUtils';
import { Link } from '~/common/components/Link';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { VideoPlayerYouTube } from '~/common/components/VideoPlayerYouTube';

import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorLMStudio } from './lmstudio.vendor';


export function LMStudioServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const { service, serviceAccess, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorLMStudio);

  // derived state
  const { clientSideFetch, oaiHost } = serviceAccess;

  // validate if url is a well formed proper url with zod
  const urlSchema = z.url().startsWith('http');
  const { success: isValidHost } = urlSchema.safeParse(oaiHost);
  const shallFetchSucceed = isValidHost;

  // fetch models - the OpenAI way
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(false /* use button only (we don't have server-side conf) */, service);

  return <>

    <ExpanderAccordion
      title={<Typography level='title-sm' sx={{ mr: 'auto' }}>Video Tutorial</Typography>}
      icon={<YouTubeIcon sx={{ color: '#f00' }} />}
      // expandedVariant='solid'
      startCollapsed
    >
      {/* play='auto': the accordion-expand click grants unmuted autoplay (the embed mounts on reveal, via its visibility gate), like the pre-2026-07 behavior */}
      <VideoPlayerYouTube width='100%' height={360} youTubeVideoId='MqXzxVokMDk' title='Running big-AGI locally with LM Studio [TUTORIAL]' play='auto' rounded />
    </ExpanderAccordion>

    <Typography level='body-sm'>
      You can use a running <Link href='https://lmstudio.ai/' target='_blank'>LM Studio</Link> instance as a source
      for local models. Please refer to our <ExternalDocsLink level='body-sm' docPage='connect-lmstudio'>configuration guide</ExternalDocsLink> for
      how to link to your LM Studio instance.
    </Typography>

    <FormInputKey
      autoCompleteId='lmstudio-url' label='LM Studio API'
      required noKey
      rightLabel={<ExternalDocsLink level='body-sm' docPage='connect-lmstudio'>Learn more</ExternalDocsLink>}
      placeholder='e.g., http://127.0.0.1:1234'
      value={oaiHost} onChange={value => updateSettings({ oaiHost: value })}
    />

    {/* [2026-08-23] not behind 'Advanced': a LAN/localhost LM Studio is only reachable from the browser, so this is the primary control (same as LocalAI/Ollama) */}
    <SetupFormClientSideToggle
      visible={true}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Fetch models and make requests directly from your LM Studio instance using the browser. Recommended for local setups - requires CORS enabled in LM Studio (Developer > Server Settings).'
      localHostDetected={isLocalUrl(oaiHost)}
    />

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} />

    {/* [2026-08-23] the browser reports a failed direct fetch as an opaque 'Failed to fetch' - it may not say
        CORS, and by far the most common cause is exactly that, so lead with the fix and keep the raw error below */}
    {isError && !!clientSideFetch && (
      <Alert variant='soft' color='primary'>
        <Typography level='body-sm' color='primary' variant='soft'>
          Make sure CORS is enabled on the LM Studio server. Open the <b>Developer</b> tab, press <b>Server Settings</b>, and turn on <b>Enable CORS</b>.
        </Typography>
      </Alert>
    )}

    {isError && <InlineError error={error} />}

  </>;
}
