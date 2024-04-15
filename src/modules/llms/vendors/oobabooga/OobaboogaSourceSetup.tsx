import * as React from 'react';

import { Alert, Typography } from '@mui/joy';

import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import { DModelSourceId } from '../../store-llms';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useSourceSetup } from '../useSourceSetup';

import { ModelVendorOoobabooga } from './oobabooga.vendor';


export function OobaboogaSourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const { source, sourceHasLLMs, access, updateSetup } =
    useSourceSetup(props.sourceId, ModelVendorOoobabooga);

  // derived state
  const { oaiHost } = access;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(false /* use button only (we don't have server-side conf) */, source);

  return <>

    <Typography level='body-sm'>
      You can use a running <Link href='https://github.com/oobabooga/text-generation-webui' target='_blank'>
      text-generation-webui</Link> instance as a source for local models.
      Follow <Link href='https://github.com/enricoros/big-agi/blob/main/docs/config-local-oobabooga.md' target='_blank'>
      the instructions</Link> to set up the server.
    </Typography>

    <FormTextField
      autoCompleteId='oobabooga-host'
      title='API Base'
      description='Excluding /v1'
      placeholder='http://127.0.0.1:5000'
      value={oaiHost}
      onChange={text => updateSetup({ oaiHost: text })}
    />

    {sourceHasLLMs && <Alert variant='soft' color='warning' sx={{ display: 'block' }}>
      Success! Note: your model of choice must be loaded in
      the <Link noLinkStyle href='http://127.0.0.1:7860' target='_blank'> Oobabooga UI</Link>,
      as Oobabooga does not support switching models via API.
      Concurrent model execution is also not supported.
    </Alert>}

    <SetupFormRefetchButton refetch={refetch} disabled={!(oaiHost.length >= 7) || isFetching} loading={isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </>;
}
