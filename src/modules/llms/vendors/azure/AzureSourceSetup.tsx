import * as React from 'react';

import { Alert, Box, Button, FormControl, FormLabel, Input, Typography } from '@mui/joy';
import SyncIcon from '@mui/icons-material/Sync';

import { apiQuery } from '~/modules/trpc/trpc.client';

import { FormInputKey } from '~/common/components/FormInputKey';
import { Link } from '~/common/components/Link';
import { asValidURL } from '~/common/util/urlUtils';
import { settingsGap } from '~/common/theme';

import { DModelSourceId, useModelsStore, useSourceSetup } from '../../store-llms';
import { modelDescriptionToDLLM } from '../openai/OpenAISourceSetup';

import { hasServerKeyAzure, isValidAzureApiKey, ModelVendorAzure } from './azure.vendor';


export function AzureSourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const {
    source, sourceLLMs, updateSetup,
    normSetup: { azureEndpoint, azureKey },
  } = useSourceSetup(props.sourceId, ModelVendorAzure.normalizeSetup);

  const hasModels = !!sourceLLMs.length;
  const needsUserKey = !hasServerKeyAzure;
  const keyValid = isValidAzureApiKey(azureKey);
  const keyError = (/*needsUserKey ||*/ !!azureKey) && !keyValid;
  const hostValid = !!asValidURL(azureEndpoint);
  const hostError = !!azureEndpoint && !hostValid;
  const shallFetchSucceed = azureKey ? keyValid : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } = apiQuery.llmAzure.listModels.useQuery({
    access: { azureEndpoint, azureKey },
  }, {
    enabled: !hasModels && shallFetchSucceed,
    onSuccess: models => source && useModelsStore.getState().addLLMs(models.models.map(model => modelDescriptionToDLLM(model, source))),
    staleTime: Infinity,
  });

  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

    <FormControl>
      <Box sx={{ display: 'flex', flexFlow: 'row wrap', gap: 1, alignItems: 'baseline', justifyContent: 'space-between' }}>
        <FormLabel>Azure Endpoint</FormLabel>
        <Link level='body-sm' href='https://oai.azure.com/portal/deployment' target='_blank'>deployments</Link>
      </Box>
      <Input
        variant='outlined'
        value={azureEndpoint} onChange={event => updateSetup({ azureEndpoint: event.target.value })}
        placeholder='https://your-resource-name.openai.azure.com/'
        error={hostError}
      />
    </FormControl>

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

    <Box sx={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between' }}>
      <Button
        variant='solid' color={isError ? 'warning' : 'primary'}
        disabled={!shallFetchSucceed || isFetching}
        endDecorator={<SyncIcon />}
        onClick={() => refetch()}
        sx={{ minWidth: 120, ml: 'auto' }}
      >
        Models
      </Button>
    </Box>

    {isError && <Alert variant='soft' color='warning' sx={{ mt: 1 }}><Typography>Issue: {error?.message || error?.toString() || 'unknown'}</Typography></Alert>}

  </Box>;
}