import * as React from 'react';

import { Alert, Box, Button, FormControl, FormLabel, Input, Typography } from '@mui/joy';
import SyncIcon from '@mui/icons-material/Sync';

import { apiQuery } from '~/modules/trpc/trpc.client';
import { modelDescriptionToDLLM } from '~/modules/llms/anthropic/AnthropicSourceSetup';

import { FormInputKey } from '~/common/components/FormInputKey';
import { Link } from '~/common/components/Link';
import { asValidURL } from '~/common/util/urlUtils';
import { settingsGap } from '~/common/theme';

import { DModelSourceId } from '../llm.types';
import { useModelsStore, useSourceSetup } from '../store-llms';

import { hasServerKeyAzure, isValidAzureApiKey, ModelVendorAzure } from './azure.vendor';


export function AzureSourceSetup(props: {
  sourceId: DModelSourceId
}) {

  // external state
  const {
    source, sourceLLMs, updateSetup,
    normSetup: { azureKey, azureHost },
  } = useSourceSetup(props.sourceId, ModelVendorAzure.normalizeSetup);

  const hasModels = !!sourceLLMs.length;
  const needsUserKey = !hasServerKeyAzure;
  const keyValid = isValidAzureApiKey(azureKey);
  const keyError = (/*needsUserKey ||*/ !!azureKey) && !keyValid;
  const hostValid = !!asValidURL(azureHost);
  const hostError = !!azureHost && !hostValid;
  const shallFetchSucceed = azureKey ? keyValid : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } = apiQuery.llmAzure.listModels.useQuery({
    access: { azureHost, azureKey },
  }, {
    enabled: !hasModels && shallFetchSucceed,
    onSuccess: models => source && useModelsStore.getState().addLLMs(models.models.map(model => modelDescriptionToDLLM(model, source))),
    staleTime: Infinity,
  });

  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

    <FormControl>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <FormLabel>Azure Endpoint</FormLabel>
      </Box>
      <Input
        variant='outlined'
        value={azureHost} onChange={event => updateSetup({ azureHost: event.target.value })}
        placeholder='required: https://...'
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
