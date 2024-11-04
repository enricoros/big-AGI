import * as React from 'react';

import { Alert, Typography } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorTogetherAI } from './togetherai.vendor';


const TOGETHERAI_REG_LINK = 'https://api.together.xyz/settings/api-keys';


export function TogetherAIServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const {
    service, serviceAccess, serviceHasBackendCap, serviceHasLLMs,
    partialSettings, serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorTogetherAI);

  // derived state
  const { oaiKey: togetherKey } = serviceAccess;
  const needsUserKey = !serviceHasBackendCap;

  // validate if url is a well formed proper url with zod
  const shallFetchSucceed = !needsUserKey || (!!togetherKey && serviceSetupValid);
  const showKeyError = !!togetherKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='togetherai-key' label='Together AI Key'
      rightLabel={<>{needsUserKey
        ? !togetherKey && <Link level='body-sm' href={TOGETHERAI_REG_LINK} target='_blank'>request Key</Link>
        : <AlreadySet />}
      </>}
      value={togetherKey} onChange={value => updateSettings({ togetherKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    <Typography level='body-sm'>
      The Together Inference platform allows you to run recent machine learning models with good speed and low
      cost. See the <Link href='https://www.together.ai/' target='_blank'>Together AI</Link> website for more
      information.
    </Typography>

    {advanced.on && <FormSwitchControl
      title='Rate Limiter' on='Enabled' off='Disabled'
      description={partialSettings?.togetherFreeTrial ? 'Free trial: 2 requests/2s' : 'Disabled'}
      checked={partialSettings?.togetherFreeTrial ?? false}
      onChange={on => updateSettings({ togetherFreeTrial: on })}
    />}

    {advanced.on && !!partialSettings?.togetherFreeTrial && <Alert variant='soft'>
      Note: Please refresh the models list if you toggle the rate limiter.
    </Alert>}

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
