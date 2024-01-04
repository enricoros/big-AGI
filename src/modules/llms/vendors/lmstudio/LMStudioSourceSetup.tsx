import * as React from 'react';
import { z } from 'zod';

import { Typography } from '@mui/joy';

import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import { DModelSourceId } from '../../store-llms';
import { useLlmUpdateModels } from '../useLlmUpdateModels';
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
    useLlmUpdateModels(ModelVendorLMStudio, access, false /* !sourceHasLLMs && shallFetchSucceed */, source);

  return <>

    <Typography level='body-sm'>
      You can use a running <Link href='https://lmstudio.ai/' target='_blank'>LM Studio</Link> instance as a source
      for local models. Please refer to the LM Studio configuration for how to turn on the local server.
    </Typography>

    <FormInputKey
      id='lmstudio-url' label='LM Studio API'
      required noKey
      rightLabel={<Link level='body-sm' href='https://lmstudio.ai/' target='_blank'>Learn more</Link>}
      placeholder='e.g., http://127.0.0.1:1234'
      value={oaiHost} onChange={value => updateSetup({ oaiHost: value })}
    />

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </>;
}
