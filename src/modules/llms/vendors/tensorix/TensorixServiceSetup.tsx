import * as React from 'react';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { ExternalLink } from '~/common/components/ExternalLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { SetupFormClientSideToggle } from '~/common/components/forms/SetupFormClientSideToggle';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorTensorix } from './tensorix.vendor';


const TENSORIX_REG_LINK = 'https://app.tensorix.ai/dashboard';


export function TensorixServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorTensorix);

  // derived state
  const { clientSideFetch, oaiKey: tensorixKey, oaiHost: tensorixHost } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;
  const showAdvanced = advanced.on || !!clientSideFetch || !!tensorixHost;

  // validate if url is a well formed proper url with zod
  const shallFetchSucceed = !needsUserKey || (!!tensorixKey && serviceSetupValid);
  const showKeyError = !!tensorixKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='tensorix-key' label='Tensorix API Key'
      rightLabel={<>{needsUserKey
        ? !tensorixKey && <ExternalLink level='body-sm' href={TENSORIX_REG_LINK}>get API Key</ExternalLink>
        : <AlreadySet />}
      </>}
      value={tensorixKey} onChange={value => updateSettings({ tensorixKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='Your Tensorix API Key'
    />

    {showAdvanced && <FormTextField
      autoCompleteId='tensorix-host'
      title='API Host'
      tooltip={`An alternative Tensorix API endpoint to use instead of the default 'api.tensorix.ai'.\n\nExample:\n - https://api.tensorix.ai`}
      placeholder='e.g., https://api.tensorix.ai'
      value={tensorixHost}
      onChange={text => updateSettings({ tensorixHost: text })}
    />}

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!tensorixKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to Tensorix API from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
