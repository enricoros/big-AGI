import * as React from 'react';
import * as z from 'zod/v4';

import { Typography } from '@mui/joy';
import YouTubeIcon from '@mui/icons-material/YouTube';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { ExpanderAccordion } from '~/common/components/ExpanderAccordion';
import { ExternalDocsLink } from '~/common/components/ExternalDocsLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { isLocalUrl } from '~/common/util/urlUtils';
import { Link } from '~/common/components/Link';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormCorsHint } from '~/common/components/forms/SetupFormCorsHint';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { VideoPlayerYouTube } from '~/common/components/VideoPlayerYouTube';

import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorLlmman } from './llmman.vendor';


export function LlmmanServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const { service, serviceAccess, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorLlmman);

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
      <VideoPlayerYouTube width='100%' height={360} youTubeVideoId='MqXzxVokMDk' title='Running big-AGI locally with llmman [TUTORIAL]' play='auto' rounded />
    </ExpanderAccordion>

    <Typography level='body-sm'>
      You can use a running <Link href='https://llmman.ai/' target='_blank'>llmman</Link> instance as a source
      for local models. Please refer to our <ExternalDocsLink level='body-sm' docPage='connect-models'>configuration guide</ExternalDocsLink> for
      how to link to your llmman instance.
    </Typography>

    <FormInputKey
      autoCompleteId='llmman-url' label='llmman API'
      required noKey
      rightLabel={<ExternalDocsLink level='body-sm' docPage='connect-models'>Learn more</ExternalDocsLink>}
      placeholder='e.g., http://127.0.0.1:17434'
      value={oaiHost} onChange={value => updateSettings({ oaiHost: value })}
    />

    {/* [2026-08-23] not behind 'Advanced': a LAN/localhost llmman is only reachable from the browser, so this is the primary control (same as LocalAI/Ollama) */}
    <SetupFormClientSideToggle
      visible={true}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Fetch models and make requests directly from your llmman instance using the browser. Recommended for local setups - requires CORS enabled in llmman (Developer > Server Settings).'
      localHostDetected={isLocalUrl(oaiHost)}
    />

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} />

    <SetupFormCorsHint visible={isError && !!clientSideFetch}>
      Make sure CORS is enabled on the llmman server. Open the <b>Developer</b> tab, press <b>Server Settings</b>, and turn on <b>Enable CORS</b>.
    </SetupFormCorsHint>

    {isError && <InlineError error={error} />}

  </>;
}
