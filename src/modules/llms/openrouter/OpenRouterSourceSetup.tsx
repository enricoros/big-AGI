import * as React from 'react';

import { Box, Button } from '@mui/joy';
import SyncIcon from '@mui/icons-material/Sync';

import { apiQuery } from '~/modules/trpc/trpc.client';

import { FormInputKey } from '~/common/components/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { settingsGap } from '~/common/theme';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '~/modules/llms/openai/openai.vendor';

import { DLLM, DModelSource, DModelSourceId } from '../llm.types';
import { useModelsStore, useSourceSetup } from '../store-llms';

import { isValidOpenRouterKey, ModelVendorOpenRouter } from './openrouter.vendor';
import { OpenAI } from '~/modules/llms/openai/openai.types';

export function OpenRouterSourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const {
    source, sourceLLMs, updateSetup,
    normSetup: { oaiHost, oaiKey },
  } = useSourceSetup(props.sourceId, ModelVendorOpenRouter.normalizeSetup);

  const hasModels = !!sourceLLMs.length;
  const needsUserKey = true; // !hasServerKeyAnthropic;
  const keyValid = isValidOpenRouterKey(oaiKey);
  const keyError = (/*needsUserKey ||*/ !!oaiKey) && !keyValid;
  const shallFetchSucceed = oaiKey ? keyValid : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } = apiQuery.llmOpenAI.listModels.useQuery({
    access: ModelVendorOpenAI.normalizeSetup({ oaiHost, oaiKey }),
    filterGpt: false,
  }, {
    enabled: !hasModels && shallFetchSucceed,
    onSuccess: models => {
      const llms = source ? models.map(model => openRouterModelToDLLM(model, source)) : [];
      useModelsStore.getState().addLLMs(llms);
    },
    staleTime: Infinity,
  });

  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

    <FormInputKey
      label={'OpenRouter API Key'}
      rightLabel={<>{needsUserKey
        ? !oaiKey && <Link level='body-sm' href='https://openrouter.ai/keys' target='_blank'>request Key</Link>
        : '✔️ already set in server'
      } {oaiKey && keyValid && <Link level='body-sm' href='https://openrouter.ai/activity' target='_blank'>check usage</Link>}
      </>}
      value={oaiKey} onChange={value => updateSetup({ oaiKey: value })}
      required={needsUserKey} isError={keyError}
      placeholder='sk-or-...'
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


function openRouterModelToDLLM(model: OpenAI.Wire.Models.ModelDescription, source: DModelSource): DLLM<LLMOptionsOpenAI> {
  const label = model.id;
  // const suffix = '';
  const contextWindow = (model as any)?.['context_length'] || 4096;
  return {
    id: `${source.id}-${model.id}`,
    label: label, // + (suffix ? ` (${suffix.replaceAll('-', ' ').trim()})` : ''),
    created: model.created,
    description: '??',
    tags: [], // ['stream', 'chat'],
    contextTokens: contextWindow,
    hidden: false,
    sId: source.id,
    _source: source,
    options: {
      llmRef: model.id,
      llmTemperature: 0.5,
      llmResponseTokens: Math.round(contextWindow / 8),
    },
  };
}