import * as React from 'react';

import { Box, Typography } from '@mui/joy';

import { apiQuery } from '~/common/util/trpc.client';

import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { settingsGap } from '~/common/theme';

import { LLMOptionsOpenAI } from '../openai/openai.vendor';
import { DLLM, DModelSource, DModelSourceId, useModelsStore, useSourceSetup } from '../../store-llms';

import { isValidOpenRouterKey, ModelVendorOpenRouter, SourceSetupOpenRouter } from './openrouter.vendor';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';


export function OpenRouterSourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const {
    source, sourceHasLLMs, access, updateSetup,
  } = useSourceSetup(props.sourceId, ModelVendorOpenRouter.getAccess);

  // derived state
  const { oaiKey } = access;

  const needsUserKey = !ModelVendorOpenRouter.hasServerKey;
  const keyValid = isValidOpenRouterKey(oaiKey);
  const keyError = (/*needsUserKey ||*/ !!oaiKey) && !keyValid;
  const shallFetchSucceed = oaiKey ? keyValid : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } = apiQuery.llmOpenAI.listModels.useQuery({
    access,
  }, {
    enabled: !sourceHasLLMs && shallFetchSucceed,
    onSuccess: models => {
      const llms = source ? models.sort(orFamilySortFn).map(model => openRouterModelToDLLM(model, source)) : [];
      useModelsStore.getState().addLLMs(llms);
    },
    staleTime: Infinity,
  });

  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

    {/*<Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>*/}
    {/*<OpenRouterIcon />*/}
    <Typography level='body-sm'>
      <Link href='https://openrouter.ai/keys' target='_blank'>OpenRouter</Link> is an independent, premium service
      granting access to <Link href='https://openrouter.ai/docs#models' target='_blank'>exclusive models</Link> such
      as GPT-4 32k, Claude, and more, typically unavailable to the public. <Link
      href='https://github.com/enricoros/big-agi/blob/main/docs/config-openrouter.md'>Configuration &amp; documentation</Link>.
    </Typography>
    {/*</Box>*/}

    <FormInputKey
      id='openrouter-key' label='OpenRouter API Key'
      rightLabel={<>{needsUserKey
        ? !oaiKey && <Link level='body-sm' href='https://openrouter.ai/keys' target='_blank'>create key</Link>
        : '✔️ already set in server'
      } {oaiKey && keyValid && <Link level='body-sm' href='https://openrouter.ai/activity' target='_blank'>check usage</Link>}
      </>}
      value={oaiKey} onChange={value => updateSetup({ oaiKey: value })}
      required={needsUserKey} isError={keyError}
      placeholder='sk-or-...'
    />

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} error={isError} />

    {isError && <InlineError error={error} />}

  </Box>;
}


// created to reflect the doc page: https://openrouter.ai/docs - update prompt:
// "Please update the typescript object (do not change the definition, just the object), based on the updated upstream documentation, below:"
const orModelMap: { [id: string]: { name: string; contextWindowSize: number; cost1kPrompt: number; cost1kCompletion: number; isOld: boolean; } } = {
  'mistralai/mistral-7b-instruct': { name: 'Mistral 7B Instruct v0.1 (beta)', contextWindowSize: 4096, cost1kPrompt: 0, cost1kCompletion: 0, isOld: false },
  'openai/gpt-3.5-turbo': { name: 'OpenAI: GPT-3.5 Turbo', contextWindowSize: 4095, cost1kPrompt: 0.0015, cost1kCompletion: 0.002, isOld: false },
  'openai/gpt-3.5-turbo-16k': { name: 'OpenAI: GPT-3.5 Turbo 16k', contextWindowSize: 16383, cost1kPrompt: 0.003, cost1kCompletion: 0.004, isOld: false },
  'openai/gpt-4': { name: 'OpenAI: GPT-4', contextWindowSize: 8191, cost1kPrompt: 0.03, cost1kCompletion: 0.06, isOld: false },
  'openai/gpt-4-32k': { name: 'OpenAI: GPT-4 32k', contextWindowSize: 32767, cost1kPrompt: 0.06, cost1kCompletion: 0.12, isOld: false },
  'openai/gpt-3.5-turbo-instruct': { name: 'OpenAI: GPT-3.5 Turbo Instruct', contextWindowSize: 4095, cost1kPrompt: 0.0015, cost1kCompletion: 0.002, isOld: false },
  'anthropic/claude-2': { name: 'Anthropic: Claude v2', contextWindowSize: 100000, cost1kPrompt: 0.01102, cost1kCompletion: 0.03268, isOld: false },
  'anthropic/claude-instant-v1': { name: 'Anthropic: Claude Instant v1', contextWindowSize: 100000, cost1kPrompt: 0.00163, cost1kCompletion: 0.00551, isOld: false },
  'google/palm-2-chat-bison': { name: 'Google: PaLM 2 Bison', contextWindowSize: 8000, cost1kPrompt: 0.0005, cost1kCompletion: 0.0005, isOld: false },
  'google/palm-2-codechat-bison': { name: 'Google: PaLM 2 Bison (Code Chat)', contextWindowSize: 8000, cost1kPrompt: 0.0005, cost1kCompletion: 0.0005, isOld: false },
  'meta-llama/llama-2-13b-chat': { name: 'Meta: Llama v2 13B Chat (beta)', contextWindowSize: 4096, cost1kPrompt: 0.0002, cost1kCompletion: 0.0002, isOld: false },
  'meta-llama/llama-2-70b-chat': { name: 'Meta: Llama v2 70B Chat (beta)', contextWindowSize: 4096, cost1kPrompt: 0.001, cost1kCompletion: 0.001, isOld: false },
  'meta-llama/codellama-34b-instruct': { name: 'Meta: CodeLlama 34B Instruct (beta)', contextWindowSize: 8096, cost1kPrompt: 0.0004, cost1kCompletion: 0.0004, isOld: false },
  'phind/phind-codellama-34b-v2': { name: 'Phind: Phind CodeLlama 34B v2 (beta)', contextWindowSize: 4096, cost1kPrompt: 0.0004, cost1kCompletion: 0.0004, isOld: false },
  'nousresearch/nous-hermes-llama2-13b': { name: 'Nous: Hermes Llama2 13B (beta)', contextWindowSize: 4096, cost1kPrompt: 0.0002, cost1kCompletion: 0.0002, isOld: false },
  'gryphe/mythomax-l2-13b': { name: 'MythoMax L2 13B (beta)', contextWindowSize: 4096, cost1kPrompt: 0.0008, cost1kCompletion: 0.0008, isOld: false },
  'mancer/weaver': { name: 'Mancer: Weaver 12k (alpha)', contextWindowSize: 8000, cost1kPrompt: 0.0045, cost1kCompletion: 0.0045, isOld: false },
  'pygmalionai/mythalion-13b': { name: 'Pygmalion: Mythalion 13B (beta)', contextWindowSize: 8192, cost1kPrompt: 0.001125, cost1kCompletion: 0.001125, isOld: false },
  'undi95/remm-slerp-l2-13b': { name: 'ReMM SLERP L2 13B (beta)', contextWindowSize: 6144, cost1kPrompt: 0.001125, cost1kCompletion: 0.001125, isOld: false },
  'jondurbin/airoboros-l2-70b': { name: 'Airoboros L2 70B (beta)', contextWindowSize: 8192, cost1kPrompt: 0.009375, cost1kCompletion: 0.009375, isOld: false },
  'migtissera/synthia-70b': { name: 'Synthia 70B (beta)', contextWindowSize: 8192, cost1kPrompt: 0.009375, cost1kCompletion: 0.009375, isOld: false },
  'xwin-lm/xwin-lm-70b': { name: 'Xwin 70B (beta)', contextWindowSize: 8192, cost1kPrompt: 0.009375, cost1kCompletion: 0.009375, isOld: false },
  'openai/gpt-3.5-turbo-0301': { name: 'OpenAI: GPT-3.5 Turbo (older v0301)', contextWindowSize: 4095, cost1kPrompt: 0.0015, cost1kCompletion: 0.002, isOld: true },
  'openai/gpt-4-0314': { name: 'OpenAI: GPT-4 (older v0314)', contextWindowSize: 8191, cost1kPrompt: 0.03, cost1kCompletion: 0.06, isOld: true },
  'openai/gpt-4-32k-0314': { name: 'OpenAI: GPT-4 32k (older v0314)', contextWindowSize: 32767, cost1kPrompt: 0.06, cost1kCompletion: 0.12, isOld: true },
  'openai/text-davinci-002': { name: 'OpenAI: Davinci 2', contextWindowSize: 4095, cost1kPrompt: 0.02, cost1kCompletion: 0.02, isOld: true },
  'anthropic/claude-v1': { name: 'Anthropic: Claude v1', contextWindowSize: 9000, cost1kPrompt: 0.01102, cost1kCompletion: 0.03268, isOld: true },
  'anthropic/claude-1.2': { name: 'Anthropic: Claude (older v1)', contextWindowSize: 9000, cost1kPrompt: 0.01102, cost1kCompletion: 0.03268, isOld: true },
  'anthropic/claude-instant-v1-100k': { name: 'Anthropic: Claude Instant 100k v1', contextWindowSize: 100000, cost1kPrompt: 0.00163, cost1kCompletion: 0.00551, isOld: true },
  'anthropic/claude-v1-100k': { name: 'Anthropic: Claude 100k v1', contextWindowSize: 100000, cost1kPrompt: 0.01102, cost1kCompletion: 0.03268, isOld: true },
  'anthropic/claude-instant-1.0': { name: 'Anthropic: Claude Instant (older v1)', contextWindowSize: 9000, cost1kPrompt: 0.00163, cost1kCompletion: 0.00551, isOld: true },
};

const orModelFamilyOrder = ['openai/', 'anthropic/', 'google/', 'mistralai/', 'meta-llama/'];

function orFamilySortFn(a: { id: string }, b: { id: string }): number {
  const aPrefixIndex = orModelFamilyOrder.findIndex(prefix => a.id.startsWith(prefix));
  const bPrefixIndex = orModelFamilyOrder.findIndex(prefix => b.id.startsWith(prefix));

  // If both have a prefix, sort by prefix first, and then alphabetically
  if (aPrefixIndex !== -1 && bPrefixIndex !== -1)
    return aPrefixIndex !== bPrefixIndex ? aPrefixIndex - bPrefixIndex : a.id.localeCompare(b.id);

  // If one has a prefix and the other doesn't, prioritize the one with prefix
  return aPrefixIndex !== -1 ? -1 : 1;
}


function openRouterModelToDLLM(model: { id: string, created: number }, source: DModelSource<SourceSetupOpenRouter>): DLLM<SourceSetupOpenRouter, LLMOptionsOpenAI> {
  // label: use the known name if available, otherwise format the model id
  const orModel = orModelMap[model.id] ?? null;
  let label = orModel?.name || model.id.replace('/', ' · ');
  if (orModel?.cost1kPrompt === 0 && orModel?.cost1kCompletion === 0)
    label += ' - 🎁 Free';

  // context: use the known size if available, otherwise fallback to the (undocumneted) provided length or fallback again to 4096
  const contextWindow = orModel?.contextWindowSize || (model as any)?.['context_length'] || 4096;

  // hidden: hide by default older models or models not in known families
  const hidden = orModel?.isOld || !orModelFamilyOrder.some(prefix => model.id.startsWith(prefix));

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