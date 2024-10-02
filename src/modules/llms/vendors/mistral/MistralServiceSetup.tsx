import * as React from 'react';

import { Typography } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorMistral } from './mistral.vendor';


const MISTRAL_REG_LINK = 'https://console.mistral.ai/';


export function MistralServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const { service, serviceAccess, serviceHasBackendCap, serviceHasLLMs, serviceSetupValid, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorMistral);

  // derived state
  const { oaiKey: mistralKey } = serviceAccess;
  const needsUserKey = !serviceHasBackendCap;

  const shallFetchSucceed = !needsUserKey || (!!mistralKey && serviceSetupValid);
  const showKeyError = !!mistralKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='mistral-key' label='Mistral Key'
      rightLabel={<>{needsUserKey
        ? !mistralKey && <Link level='body-sm' href={MISTRAL_REG_LINK} target='_blank'>request Key</Link>
        : <AlreadySet />}
      </>}
      value={mistralKey} onChange={value => updateSettings({ oaiKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    <Typography level='body-sm'>
      In order of capabilities we have Large, Medium, Small (Open 8x7B = Small 2312) and Tiny (Open 7B = Tiny 2312) models.
      Note the elegance of the numbers, representing the Year and Month or release (YYMM).
    </Typography>

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </>;
}