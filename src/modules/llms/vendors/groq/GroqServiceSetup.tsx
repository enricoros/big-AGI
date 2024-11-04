import * as React from 'react';

import { Typography } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import { ApproximateCosts } from '../ApproximateCosts';
import { ModelVendorGroq } from './groq.vendor';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';


const GROQ_REG_LINK = 'https://console.groq.com/keys';


export function GroqServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const {
    service, serviceAccess, serviceHasBackendCap, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorGroq);

  // derived state
  const { oaiKey: groqKey } = serviceAccess;
  const needsUserKey = !serviceHasBackendCap;

  // key validation
  const shallFetchSucceed = !needsUserKey || (!!groqKey && serviceSetupValid);
  const showKeyError = !!groqKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='groq-key' label='Groq API Key'
      rightLabel={<>{needsUserKey
        ? !groqKey && <Link level='body-sm' href={GROQ_REG_LINK} target='_blank'>API keys</Link>
        : <AlreadySet />}
      </>}
      value={groqKey} onChange={value => updateSettings({ groqKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    <Typography level='body-sm'>
      <Link href='https://console.groq.com/docs/quickstart'>Groq</Link> offers inference
      as a service for a variety of models. See the <Link href='https://www.groq.com/' target='_blank'>Groq</Link> website for more information.
    </Typography>

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </>;
}
