import * as React from 'react';

import { Alert, Box } from '@mui/joy';

import { apiQuery } from '~/common/util/trpc.client';

import { Brand } from '~/common/brand';
import { FormInputKey } from '~/common/components/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { useToggleableBoolean } from '~/common/util/useToggleableBoolean';
import { settingsGap } from '~/common/theme';

import type { ModelDescriptionSchema } from '../../transports/server/server.common';
import { DLLM, DModelSource, DModelSourceId, useModelsStore, useSourceSetup } from '../../store-llms';

import { RefetchButton, SetupSwitchControl, SetupTextControl } from '../vendor.components';
import { isValidOpenAIApiKey, LLMOptionsOpenAI, ModelVendorOpenAI, SourceSetupOpenAI } from './openai.vendor';
import { openAIModelToModelDescription } from './openai.data';


export function OpenAISourceSetup(props: { sourceId: DModelSourceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const { source, sourceHasLLMs, access, updateSetup } =
    useSourceSetup(props.sourceId, ModelVendorOpenAI.getAccess);

  // derived state
  const { oaiKey, oaiOrg, oaiHost, heliKey, moderationCheck } = access;

  const needsUserKey = !ModelVendorOpenAI.hasServerKey;
  const keyValid = isValidOpenAIApiKey(oaiKey);
  const keyError = (/*needsUserKey ||*/ !!oaiKey) && !keyValid;
  const shallFetchSucceed = oaiKey ? keyValid : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } = apiQuery.llmOpenAI.listModels.useQuery({
    access, filterGpt: true,
  }, {
    enabled: !sourceHasLLMs && shallFetchSucceed,
    onSuccess: models => {
      const llms = source ? models.map(model => openAIModelToDLLM(model, source)) : [];
      useModelsStore.getState().addLLMs(llms);
    },
    staleTime: Infinity,
  });


  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

    <FormInputKey
      id='openai-key' label='API Key'
      rightLabel={<>{needsUserKey
        ? !oaiKey && <><Link level='body-sm' href='https://platform.openai.com/account/api-keys' target='_blank'>create Key</Link> and <Link level='body-sm' href='https://openai.com/waitlist/gpt-4-api' target='_blank'>apply to GPT-4</Link></>
        : '✔️ already set in server'
      } {oaiKey && keyValid && <Link level='body-sm' href='https://platform.openai.com/account/usage' target='_blank'>check usage</Link>}
      </>}
      value={oaiKey} onChange={value => updateSetup({ oaiKey: value })}
      required={needsUserKey} isError={keyError}
      placeholder='sk-...'
    />

    {advanced.on && <SetupTextControl
      title='Organization ID'
      description={<Link level='body-sm' href={`${Brand.URIs.OpenRepo}/issues/63`} target='_blank'>What is this</Link>}
      placeholder='Optional, for enterprise users'
      value={oaiOrg}
      onChange={text => updateSetup({ oaiOrg: text })}
    />}

    {advanced.on && <SetupTextControl
      title='API Host'
      description={<><Link level='body-sm' href='https://www.helicone.ai' target='_blank'>Helicone</Link>, ...</>}
      placeholder='e.g., oai.hconeai.com'
      value={oaiHost}
      onChange={text => updateSetup({ oaiHost: text })}
    />}

    {advanced.on && <SetupTextControl
      title='Helicone Key'
      description={<>Generate <Link level='body-sm' href='https://www.helicone.ai/keys' target='_blank'>here</Link></>}
      placeholder='sk-...'
      value={heliKey}
      onChange={text => updateSetup({ heliKey: text })}
    />}

    {!!heliKey && <Alert variant='soft' color={oaiHost?.includes('oai.hconeai.com') ? 'success' : 'warning'}>
      Advanced: You set the Helicone key. {!oaiHost?.includes('oai.hconeai.com')
      ? 'But you also need to set the OpenAI Host to "oai.hconeai.com" to use Helicone.'
      : 'OpenAI traffic will now be routed through Helicone.'}
    </Alert>}

    {advanced.on && <SetupSwitchControl
      title='Moderation'
      description={<>
        <Link level='body-sm' href='https://platform.openai.com/docs/guides/moderation/moderation' target='_blank'>Overview</Link>,
        {' '}<Link level='body-sm' href='https://openai.com/policies/usage-policies' target='_blank'>policy</Link>
      </>}
      value={moderationCheck}
      onChange={on => updateSetup({ moderationCheck: on })}
    />}

    <RefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </Box>;
}


function openAIModelToDLLM(model: { id: string, created: number }, source: DModelSource): DLLM<SourceSetupOpenAI, LLMOptionsOpenAI> {
  const { label, created, updated, description, contextWindow: contextTokens, hidden } = openAIModelToModelDescription(model.id, model.created);
  return {
    id: `${source.id}-${model.id}`,

    label,
    created: created || 0,
    updated: updated || 0,
    description,
    tags: [], // ['stream', 'chat'],
    contextTokens,
    hidden: hidden || false,

    sId: source.id,
    _source: source,

    options: {
      llmRef: model.id,
      llmTemperature: 0.5,
      llmResponseTokens: Math.round(contextTokens / 8),
    },
  };
}

export function modelDescriptionToDLLM<TSourceSetup>(model: ModelDescriptionSchema, source: DModelSource<TSourceSetup>): DLLM<TSourceSetup, LLMOptionsOpenAI> {
  return {
    id: `${source.id}-${model.id}`,
    label: model.label,
    created: model.created || 0,
    updated: model.updated || 0,
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