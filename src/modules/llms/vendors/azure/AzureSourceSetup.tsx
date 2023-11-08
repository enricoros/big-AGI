import * as React from 'react';

import { Box } from '@mui/joy';

import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { apiQuery } from '~/common/util/trpc.client';
import { asValidURL } from '~/common/util/urlUtils';
import { settingsGap } from '~/common/theme';

import { DModelSourceId, useModelsStore, useSourceSetup } from '../../store-llms';
import { modelDescriptionToDLLM } from '../openai/OpenAISourceSetup';

import { isValidAzureApiKey, ModelVendorAzure } from './azure.vendor';


export function AzureSourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const { source, sourceHasLLMs, access, updateSetup } =
    useSourceSetup(props.sourceId, ModelVendorAzure.getAccess);

  // derived state
  const { oaiKey: azureKey, oaiHost: azureEndpoint } = access;

  const needsUserKey = !ModelVendorAzure.hasServerKey;
  const keyValid = isValidAzureApiKey(azureKey);
  const keyError = (/*needsUserKey ||*/ !!azureKey) && !keyValid;
  const hostValid = !!asValidURL(azureEndpoint);
  const hostError = !!azureEndpoint && !hostValid;
  const shallFetchSucceed = azureKey ? keyValid : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } = apiQuery.llmOpenAI.listModels.useQuery({ access }, {
    enabled: !sourceHasLLMs && shallFetchSucceed,
    onSuccess: models => source && useModelsStore.getState().addLLMs(models.models.map(model => modelDescriptionToDLLM(model, source))),
    staleTime: Infinity,
  });

  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

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

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </Box>;
}