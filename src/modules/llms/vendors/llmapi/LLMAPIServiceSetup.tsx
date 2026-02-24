import * as React from 'react';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { ExternalLink } from '~/common/components/ExternalLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { ModelVendorLLMAPI } from './llmapi.vendor';


const LLMAPI_SIGNUP_LINK = 'https://llmapi.ai';


export function LLMAPIServiceSetup(props: { serviceId: DModelsServiceId }) {

  const advanced = useToggleableBoolean();

  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorLLMAPI);

  const { oaiKey: llmapiKey } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;

  const shallFetchSucceed = !needsUserKey || (!!llmapiKey && serviceSetupValid);
  const showKeyError = !!llmapiKey && !serviceSetupValid;

  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='llmapi-key' label='LLM API Key'
      rightLabel={<>{needsUserKey
        ? !llmapiKey && <ExternalLink level='body-sm' href={LLMAPI_SIGNUP_LINK}>get API key</ExternalLink>
        : <AlreadySet />}
      </>}
      value={llmapiKey} onChange={value => updateSettings({ llmapiKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='Your LLM API Key'
    />

    <SetupFormRefetchButton refetch={refetch} disabled={isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
