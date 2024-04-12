import * as React from 'react';
import { z } from 'zod';

import { Typography } from '@mui/joy';
import YouTubeIcon from '@mui/icons-material/YouTube';

import { ExpanderAccordion } from '~/common/components/ExpanderAccordion';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { VideoPlayer } from '~/common/components/VideoPlayer';

import { DModelSourceId } from '../../store-llms';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useSourceSetup } from '../useSourceSetup';

import { ModelVendorLMStudio } from './lmstudio.vendor';


export function LMStudioSourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const { source, access, updateSetup } =
    useSourceSetup(props.sourceId, ModelVendorLMStudio);

  // derived state
  const { oaiHost } = access;

  // validate if url is a well formed proper url with zod
  const urlSchema = z.string().url().startsWith('http');
  const { success: isValidHost } = urlSchema.safeParse(oaiHost);
  const shallFetchSucceed = isValidHost;

  // fetch models - the OpenAI way
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(false /* use button only (we don't have server-side conf) */, source);

  return <>

    <ExpanderAccordion
      title={<Typography level='title-sm' sx={{ mr: 'auto' }}>Video Tutorial</Typography>}
      icon={<YouTubeIcon sx={{ color: '#f00' }} />}
      expandedVariant='solid'
      startCollapsed
    >
      <VideoPlayer width='100%' youTubeVideoId='MqXzxVokMDk' playing={true} />
    </ExpanderAccordion>

    <Typography level='body-sm'>
      You can use a running <Link href='https://lmstudio.ai/' target='_blank'>LM Studio</Link> instance as a source
      for local models. Please refer to our <Link
      level='body-sm' href='https://github.com/enricoros/big-agi/blob/main/docs/config-local-lmstudio.md' target='_blank'>configuration guide</Link> for
      how to link to your LM Studio instance.
    </Typography>

    <FormInputKey
      autoCompleteId='lmstudio-url' label='LM Studio API'
      required noKey
      rightLabel={<Link level='body-sm' href='https://github.com/enricoros/big-agi/blob/main/docs/config-local-lmstudio.md' target='_blank'>Learn more</Link>}
      placeholder='e.g., http://127.0.0.1:1234'
      value={oaiHost} onChange={value => updateSetup({ oaiHost: value })}
    />

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </>;
}
