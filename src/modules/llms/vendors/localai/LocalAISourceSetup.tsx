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

import { ModelVendorLocalAI } from './localai.vendor';


export function LocalAISourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const { source, access, updateSetup } =
    useSourceSetup(props.sourceId, ModelVendorLocalAI);

  // derived state
  const { oaiHost } = access;

  // validate if url is a well formed proper url with zod
  const urlSchema = z.string().url().startsWith('http');
  const { success: isValidHost } = urlSchema.safeParse(oaiHost);
  const shallFetchSucceed = isValidHost;

  // fetch models - the OpenAI way
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(ModelVendorLocalAI, access, false /* !sourceHasLLMs && shallFetchSucceed */, source);

  return <>

    <Typography level='body-sm'>
      You can use a running <Link href='https://localai.io' target='_blank'>LocalAI</Link> instance as a source for local models.
      Please refer to the LocalAI website for how to get it setup and running with models, and then enter the URL below.
    </Typography>

    <FormInputKey
      id='localai-key' label='LocalAI URL'
      required noKey
      rightLabel={<Link level='body-sm' href='https://localai.io' target='_blank'>Learn more</Link>}
      placeholder='e.g., http://127.0.0.1:8080'
      value={oaiHost} onChange={value => updateSetup({ oaiHost: value })}
    />

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </>;
}
