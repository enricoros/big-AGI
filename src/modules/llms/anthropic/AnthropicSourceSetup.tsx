import * as React from 'react';

import { Box, Button } from '@mui/joy';
import SyncIcon from '@mui/icons-material/Sync';

import { apiQuery } from '~/modules/trpc/trpc.client';

import { FormInputKey } from '~/common/components/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { settingsGap } from '~/common/theme';

import { LLMOptionsOpenAI } from '~/modules/llms/openai/openai.vendor';

import { DLLM, DModelSource, DModelSourceId } from '../llm.types';
import { hasServerKeyAnthropic, isValidAnthropicApiKey, ModelVendorAnthropic } from './anthropic.vendor';
import { useModelsStore, useSourceSetup } from '../store-llms';


export function AnthropicSourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const {
    source, sourceLLMs, updateSetup,
    normSetup: { anthropicKey, anthropicHost },
  } = useSourceSetup(props.sourceId, ModelVendorAnthropic.normalizeSetup);

  const hasModels = !!sourceLLMs.length;
  const needsUserKey = !hasServerKeyAnthropic;
  const keyValid = isValidAnthropicApiKey(anthropicKey);
  const keyError = (/*needsUserKey ||*/ !!anthropicKey) && !keyValid;
  const shallFetchSucceed = anthropicKey ? keyValid : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } = apiQuery.llmAnthropic.listModels.useQuery({
    access: { anthropicKey, anthropicHost },
  }, {
    enabled: !hasModels && shallFetchSucceed,
    onSuccess: models => source && useModelsStore.getState().addLLMs(models.models.map(model => anthropicModelToDLLM(model, source))),
    staleTime: Infinity,
  });

  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

    <FormInputKey
      label={'Anthropic API Key'}
      rightLabel={<>{needsUserKey
        ? !anthropicKey && <Link level='body-sm' href='https://www.anthropic.com/earlyaccess' target='_blank'>request Key</Link>
        : '✔️ already set in server'
      } {anthropicKey && keyValid && <Link level='body-sm' href='https://console.anthropic.com/' target='_blank'>check usage</Link>}
      </>}
      value={anthropicKey} onChange={value => updateSetup({ anthropicKey: value })}
      required={needsUserKey} isError={keyError}
      placeholder='sk-...'
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

    {isError && <InlineError error={error} />}

  </Box>;
}


function anthropicModelToDLLM(model: { id: string, created: number, description: string, name: string, contextWindow: number, hidden?: boolean }, source: DModelSource): DLLM<LLMOptionsOpenAI> {
  return {
    id: `${source.id}-${model.id}`,
    label: model.name,
    created: model.created,
    description: model.description,
    tags: [], // ['stream', 'chat'],
    contextTokens: model.contextWindow,
    hidden: !!model.hidden,
    sId: source.id,
    _source: source,
    options: {
      llmRef: model.id,
      llmTemperature: 0.5,
      llmResponseTokens: Math.round(model.contextWindow / 8),
    },
  };
}