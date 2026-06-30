import * as React from 'react';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { ModelVendorCerebras } from './cerebras.vendor';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';


const CEREBRAS_REG_LINK = 'https://cloud.cerebras.ai/';


export function CerebrasServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorCerebras);

  // derived state
  const { clientSideFetch, oaiKey: cerebrasKey } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  // advanced mode - initialize open if CSF is enabled, but let user toggle freely
  const advanced = useToggleableBoolean(!!clientSideFetch);
  const showAdvanced = advanced.on;

  // key validation
  const shallFetchSucceed = !needsUserKey || (!!cerebrasKey && serviceSetupValid);
  const showKeyError = !!cerebrasKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='cerebras-key' label='Cerebras API Key'
      rightLabel={<>{needsUserKey
        ? !cerebrasKey && <Link level='body-sm' href={CEREBRAS_REG_LINK} target='_blank'>API keys</Link>
        : <AlreadySet />}
      </>}
      value={cerebrasKey} onChange={value => updateSettings({ cerebrasKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='...'
    />

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!cerebrasKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to Cerebras API from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
