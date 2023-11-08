import * as React from 'react';

import { Alert, Box } from '@mui/joy';

import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { apiQuery } from '~/common/util/trpc.client';
import { settingsGap } from '~/common/theme';
import { useToggleableBoolean } from '~/common/util/useToggleableBoolean';

import { DModelSourceId, useModelsStore, useSourceSetup } from '../../store-llms';
import { modelDescriptionToDLLM } from '../openai/OpenAISourceSetup';

import { isValidAnthropicApiKey, ModelVendorAnthropic } from './anthropic.vendor';


export function AnthropicSourceSetup(props: { sourceId: DModelSourceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const { source, sourceHasLLMs, access, updateSetup } =
    useSourceSetup(props.sourceId, ModelVendorAnthropic.getAccess);

  // derived state
  const { anthropicKey, anthropicHost, heliconeKey } = access;

  const needsUserKey = !ModelVendorAnthropic.hasServerKey;
  const keyValid = isValidAnthropicApiKey(anthropicKey);
  const keyError = (/*needsUserKey ||*/ !!anthropicKey) && !keyValid;
  const shallFetchSucceed = anthropicKey ? keyValid : (!needsUserKey || !!anthropicHost);

  // fetch models
  const { isFetching, refetch, isError, error } = apiQuery.llmAnthropic.listModels.useQuery({ access }, {
    enabled: !sourceHasLLMs && shallFetchSucceed,
    onSuccess: models => source && useModelsStore.getState().addLLMs(models.models.map(model => modelDescriptionToDLLM(model, source))),
    staleTime: Infinity,
  });

  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

    <FormInputKey
      id='anthropic-key' label={!!anthropicHost ? 'API Key' : 'Anthropic API Key'}
      rightLabel={<>{needsUserKey
        ? !anthropicKey && <Link level='body-sm' href='https://www.anthropic.com/earlyaccess' target='_blank'>request Key</Link>
        : '✔️ already set in server'
      } {anthropicKey && keyValid && <Link level='body-sm' href='https://console.anthropic.com/' target='_blank'>check usage</Link>}
      </>}
      value={anthropicKey} onChange={value => updateSetup({ anthropicKey: value })}
      required={needsUserKey} isError={keyError}
      placeholder='sk-...'
    />

    {advanced.on && <FormTextField
      title='API Host'
      description={<>e.g., <Link level='body-sm' href='https://github.com/enricoros/big-agi/blob/main/docs/config-aws-bedrock.md' target='_blank'>bedrock-claude</Link></>}
      placeholder='deployment.service.region.amazonaws.com'
      isError={false}
      value={anthropicHost || ''}
      onChange={text => updateSetup({ anthropicHost: text })}
    />}

    {advanced.on && <FormTextField
      title='Helicone Key' disabled={!!anthropicHost}
      description={<>Generate <Link level='body-sm' href='https://www.helicone.ai/keys' target='_blank'>here</Link></>}
      placeholder='sk-...'
      value={heliconeKey || ''}
      onChange={text => updateSetup({ heliconeKey: text })}
    />}

    {!!heliconeKey && <Alert variant='soft' color='success'>
      Advanced: You set the Helicone key, and Anthropic text will be routed through Helicone.
    </Alert>}

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </Box>;
}