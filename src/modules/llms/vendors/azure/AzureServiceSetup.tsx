import * as React from 'react';

import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { asValidURL } from '~/common/util/urlUtils';

import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { isValidAzureApiKey, ModelVendorAzure } from './azure.vendor';


export function AzureServiceSetup(props: { serviceId: DModelsServiceId }) {

  // external state
  const { service, serviceAccess, serviceHasBackendCap, serviceHasLLMs, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorAzure);

  // derived state
  const { oaiKey: azureKey, oaiHost: azureEndpoint } = serviceAccess;
  const needsUserKey = !serviceHasBackendCap;

  const keyValid = isValidAzureApiKey(azureKey);
  const keyError = (/*needsUserKey ||*/ !!azureKey) && !keyValid;
  const hostValid = !!asValidURL(azureEndpoint);
  const hostError = !!azureEndpoint && !hostValid;
  const shallFetchSucceed = azureKey ? keyValid : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  return <>

    <FormTextField
      autoCompleteId='azure-endpoint'
      title='Azure Endpoint'
      description={<Link level='body-sm' href='https://github.com/enricoros/big-agi/blob/main/docs/config-azure-openai.md' target='_blank'>configuration</Link>}
      placeholder='https://your-resource-name.openai.azure.com/'
      isError={hostError}
      value={azureEndpoint}
      onChange={text => updateSettings({ azureEndpoint: text })}
    />

    <FormInputKey
      autoCompleteId='azure-key' label='Azure Key'
      rightLabel={<>{needsUserKey
        ? !azureKey && <Link level='body-sm' href='https://azure.microsoft.com/en-us/products/ai-services/openai-service' target='_blank'>request Key</Link>
        : <AlreadySet />}
      </>}
      value={azureKey} onChange={value => updateSettings({ azureKey: value })}
      required={needsUserKey} isError={keyError}
      placeholder='...'
    />

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </>;
}