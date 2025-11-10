import * as React from 'react';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';

import { ApproximateCosts } from '../ApproximateCosts';
import { ModelVendorMoonshot } from './moonshot.vendor';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';


const MOONSHOT_API_LINK = 'https://platform.moonshot.ai/console/api-keys';


export function MoonshotServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorMoonshot);

  // derived state
  const { oaiKey: moonshotKey } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  // key validation
  const shallFetchSucceed = !needsUserKey || (!!moonshotKey && serviceSetupValid);
  const showKeyError = !!moonshotKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='moonshot-key' label='Moonshot API Key'
      rightLabel={<>{needsUserKey
        ? !moonshotKey && <Link level='body-sm' href={MOONSHOT_API_LINK} target='_blank'>API keys</Link>
        : <AlreadySet />}
      </>}
      value={moonshotKey} onChange={value => updateSettings({ moonshotKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </>;
}
