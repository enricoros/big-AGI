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
import { ModelVendorGroq } from './groq.vendor';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';


const GROQ_REG_LINK = 'https://console.groq.com/keys';


export function GroqServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorGroq);

  // derived state
  const { clientSideFetch, oaiKey: groqKey } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;
  const showAdvanced = advanced.on || !!clientSideFetch;

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

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!groqKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to Groq API from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
