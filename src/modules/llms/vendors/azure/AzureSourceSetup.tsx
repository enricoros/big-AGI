import * as React from 'react';

import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { asValidURL } from '~/common/util/urlUtils';

import { DModelSourceId } from '../../store-llms';
import { useLlmUpdateModels } from '../useLlmUpdateModels';
import { useSourceSetup } from '../useSourceSetup';

import { isValidAzureApiKey, ModelVendorAzure } from './azure.vendor';


export function AzureSourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const { source, sourceHasLLMs, access, updateSetup } =
    useSourceSetup(props.sourceId, ModelVendorAzure);

  // derived state
  const { oaiKey: azureKey, oaiHost: azureEndpoint } = access;

  const needsUserKey = !ModelVendorAzure.hasBackendCap?.();
  const keyValid = isValidAzureApiKey(azureKey);
  const keyError = (/*needsUserKey ||*/ !!azureKey) && !keyValid;
  const hostValid = !!asValidURL(azureEndpoint);
  const hostError = !!azureEndpoint && !hostValid;
  const shallFetchSucceed = azureKey ? keyValid : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(ModelVendorAzure, access, !sourceHasLLMs && shallFetchSucceed, source);

  return <>

    <FormTextField
      title='Azure Endpoint'
      description={<Link level='body-sm' href='https://github.com/enricoros/big-agi/blob/main/docs/config-azure-openai.md' target='_blank'>configuration</Link>}
      placeholder='https://your-resource-name.openai.azure.com/'
      isError={hostError}
      value={azureEndpoint}
      onChange={text => updateSetup({ azureEndpoint: text })}
    />

    <FormInputKey
      id='azure-key' label='Azure Key'
      rightLabel={<>{needsUserKey
        ? !azureKey && <Link level='body-sm' href='https://azure.microsoft.com/en-us/products/ai-services/openai-service' target='_blank'>request Key</Link>
        : '✔️ already set in server'}
      </>}
      value={azureKey} onChange={value => updateSetup({ azureKey: value })}
      required={needsUserKey} isError={keyError}
      placeholder='...'
    />

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </>;
}