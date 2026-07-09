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

import { ModelVendorCohere } from './cohere.vendor';


const COHERE_REG_LINK = 'https://dashboard.cohere.com/api-keys';


export function CohereServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const {
    service, serviceAccess, serviceHasCloudTenantConfig, serviceHasLLMs,
    serviceSetupValid, updateSettings,
  } = useServiceSetup(props.serviceId, ModelVendorCohere);

  // derived state
  const { clientSideFetch, oaiKey: cohereKey, oaiHost: cohereHost } = serviceAccess;
  const needsUserKey = !serviceHasCloudTenantConfig;
  const showAdvanced = advanced.on || !!clientSideFetch || !!cohereHost;

  const shallFetchSucceed = !needsUserKey || (!!cohereKey && serviceSetupValid);
  const showKeyError = !!cohereKey && !serviceSetupValid;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);


  return <>

    <ApproximateCosts serviceId={service?.id} />

    <FormInputKey
      autoCompleteId='cohere-key' label='Cohere Key'
      rightLabel={<>{needsUserKey
        ? !cohereKey && <ExternalLink level='body-sm' href={COHERE_REG_LINK}>request Key</ExternalLink>
        : <AlreadySet />}
      </>}
      value={cohereKey} onChange={value => updateSettings({ cohereKey: value })}
      required={needsUserKey} isError={showKeyError}
      placeholder='Your Cohere API Key'
    />

    {showAdvanced && <FormTextField
      autoCompleteId='cohere-host'
      title='API Host'
      tooltip={`An alternative Cohere OpenAI-compatible endpoint to use instead of the default.\n\nDefault:\n - https://api.cohere.ai/compatibility`}
      placeholder='e.g., https://api.cohere.ai/compatibility'
      value={cohereHost}
      onChange={text => updateSettings({ cohereHost: text })}
    />}

    {showAdvanced && <SetupFormClientSideToggle
      visible={!!cohereKey}
      checked={!!clientSideFetch}
      onChange={on => updateSettings({ csf: on })}
      helpText='Connect directly to the Cohere API from your browser instead of through the server.'
    />}

    <SetupFormRefetchButton refetch={refetch} disabled={/*!shallFetchSucceed ||*/ isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}
