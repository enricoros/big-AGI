import * as React from 'react';

import { Box, Button } from '@mui/joy';
import SyncIcon from '@mui/icons-material/Sync';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '~/modules/llms/openai/openai.vendor';
import { OpenAI } from '~/modules/llms/openai/openai.types';
import { apiQuery } from '~/modules/trpc/trpc.client';

import { FormInputKey } from '~/common/components/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { settingsGap } from '~/common/theme';

import { DLLM, DModelSource, DModelSourceId } from '../llm.types';
import { useModelsStore, useSourceSetup } from '../store-llms';

import { isValidOpenRouterKey, ModelVendorOpenRouter } from './openrouter.vendor';


// adjust as Openrouter adds big model families - but keep a good SNR
const knownModelFamilies = ['openai/', 'anthropic/', 'google/', 'meta-llama/'];

function prioritizeLLMs(a: OpenAI.Wire.Models.ModelDescription, b: OpenAI.Wire.Models.ModelDescription): number {
  const aPrefixIndex = knownModelFamilies.findIndex(prefix => a.id.startsWith(prefix));
  const bPrefixIndex = knownModelFamilies.findIndex(prefix => b.id.startsWith(prefix));

  // If both have a prefix, sort by prefix first, and then alphabetically
  if (aPrefixIndex !== -1 && bPrefixIndex !== -1)
    return aPrefixIndex !== bPrefixIndex ? aPrefixIndex - bPrefixIndex : a.id.localeCompare(b.id);

  // If one has a prefix and the other doesn't, prioritize the one with prefix
  return aPrefixIndex !== -1 ? -1 : 1;
}

export function OpenRouterSourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const {
    source, sourceLLMs, updateSetup,
    normSetup: { oaiHost, oaiKey },
  } = useSourceSetup(props.sourceId, ModelVendorOpenRouter.normalizeSetup);

  const hasModels = !!sourceLLMs.length;
  const needsUserKey = true; // !hasServerKey...;
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
      const llms = source ? models.sort(prioritizeLLMs).map(model => openRouterModelToDLLM(model, source)) : [];
      useModelsStore.getState().addLLMs(llms);
    },
    staleTime: Infinity,
  });

  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

    <FormInputKey
      label={'OpenRouter API Key'}
      rightLabel={<>{needsUserKey
        ? !oaiKey && <Link level='body-sm' href='https://openrouter.ai/keys' target='_blank'>create key</Link>
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
  // label: highlight the family name
  const knownModelFamily = knownModelFamilies.find(family => model.id.startsWith(family));
  const label = (knownModelFamily ? model.id.replace(knownModelFamily, capitalizeFirstLetter(knownModelFamily)) : model.id).replace('/', ' · ');

  // context: Openrouter provides the lenght; using it
  const contextWindow = (model as any)?.['context_length'] || 4096;

  // hidden: hide older models
  const suffixesToHide = ['0301', '0314', 'davinci-002', 'instant-1.0'];
  const hidden = suffixesToHide.some(suffix => model.id.endsWith(suffix)) || !knownModelFamily;

  return {
    id: `${source.id}-${model.id}`,
    label: label,
    created: model.created,
    description: '??',
    tags: [], // ['stream', 'chat'],
    contextTokens: contextWindow,
    hidden,
    sId: source.id,
    _source: source,
    options: {
      llmRef: model.id,
      llmTemperature: 0.5,
      llmResponseTokens: Math.round(contextWindow / 8),
    },
  };
}