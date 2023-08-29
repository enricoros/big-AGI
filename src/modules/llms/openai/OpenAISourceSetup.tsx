import * as React from 'react';

import { Box, Button, FormControl, FormHelperText, FormLabel, Input, Switch } from '@mui/joy';
import SyncIcon from '@mui/icons-material/Sync';

import { apiQuery } from '~/modules/trpc/trpc.client';

import { Brand } from '~/common/brand';
import { FormInputKey } from '~/common/components/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { settingsCol1Width, settingsGap } from '~/common/theme';

import { DLLM, DModelSource, DModelSourceId } from '../llm.types';
import { OpenAI } from './openai.types';
import { hasServerKeyOpenAI, isValidOpenAIApiKey, LLMOptionsOpenAI, ModelVendorOpenAI } from './openai.vendor';
import { useModelsStore, useSourceSetup } from '../store-llms';


export function OpenAISourceSetup(props: { sourceId: DModelSourceId }) {

  // state
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // external state
  const {
    source, sourceLLMs, updateSetup,
    normSetup: { heliKey, oaiHost, oaiKey, oaiOrg, moderationCheck },
  } = useSourceSetup(props.sourceId, ModelVendorOpenAI.normalizeSetup);

  const hasModels = !!sourceLLMs.length;
  const needsUserKey = !hasServerKeyOpenAI;
  const keyValid = isValidOpenAIApiKey(oaiKey);
  const keyError = (/*needsUserKey ||*/ !!oaiKey) && !keyValid;
  const shallFetchSucceed = oaiKey ? keyValid : !needsUserKey;

  // fetch models
  const { isFetching, refetch, isError, error } = apiQuery.llmOpenAI.listModels.useQuery({
    access: { oaiKey, oaiHost, oaiOrg, heliKey, moderationCheck },
    filterGpt: true,
  }, {
    enabled: !hasModels && shallFetchSucceed,
    onSuccess: models => {
      const llms = source ? models.map(model => openAIModelToDLLM(model, source)) : [];
      useModelsStore.getState().addLLMs(llms);
    },
    staleTime: Infinity,
  });


  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

    <FormInputKey
      label={'API Key'}
      rightLabel={<>{needsUserKey
        ? !oaiKey && <><Link level='body-sm' href='https://platform.openai.com/account/api-keys' target='_blank'>create Key</Link> and <Link level='body-sm' href='https://openai.com/waitlist/gpt-4-api' target='_blank'>apply to GPT-4</Link></>
        : '✔️ already set in server'
      } {oaiKey && keyValid && <Link level='body-sm' href='https://platform.openai.com/account/usage' target='_blank'>check usage</Link>}
      </>}
      value={oaiKey} onChange={value => updateSetup({ oaiKey: value })}
      required={needsUserKey} isError={keyError}
      placeholder='sk-...'
    />

    {showAdvanced && <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: settingsCol1Width }}>
        <FormLabel>
          Organization ID
        </FormLabel>
        <FormHelperText sx={{ display: 'block' }}>
          <Link level='body-sm' href={`${Brand.URIs.OpenRepo}/issues/63`} target='_blank'>What is this</Link>
        </FormHelperText>
      </Box>
      <Input
        variant='outlined' placeholder='Optional, for enterprise users'
        value={oaiOrg} onChange={event => updateSetup({ oaiOrg: event.target.value })}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>}

    {showAdvanced && <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: settingsCol1Width }}>
        <FormLabel>
          API Host
        </FormLabel>
        <FormHelperText sx={{ display: 'block' }}>
          <Link level='body-sm' href='https://www.helicone.ai' target='_blank'>Helicone</Link>, ...
        </FormHelperText>
      </Box>
      <Input
        variant='outlined' placeholder='e.g., oai.hconeai.com'
        value={oaiHost} onChange={event => updateSetup({ oaiHost: event.target.value })}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>}

    {showAdvanced && <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: settingsCol1Width }}>
        <FormLabel>
          Helicone Key
        </FormLabel>
        <FormHelperText sx={{ display: 'block' }}>
          Generate <Link level='body-sm' href='https://www.helicone.ai/keys' target='_blank'>here</Link>
        </FormHelperText>
      </Box>
      <Input
        variant='outlined' placeholder='sk-...'
        value={heliKey} onChange={event => updateSetup({ heliKey: event.target.value })}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>}

    {showAdvanced && <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: settingsCol1Width }}>
        <FormLabel>
          Moderation
        </FormLabel>
        <FormHelperText sx={{ display: 'block' }}>
          <Link level='body-sm' href='https://platform.openai.com/docs/guides/moderation/moderation' target='_blank'>Overview</Link>,
          {' '}<Link level='body-sm' href='https://openai.com/policies/usage-policies' target='_blank'>policy</Link>
        </FormHelperText>
      </Box>
      <Switch
        checked={moderationCheck}
        onChange={event => updateSetup({ moderationCheck: event.target.checked })}
        endDecorator={moderationCheck ? 'Enabled' : 'Off'}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>}


    <Box sx={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between' }}>

      <FormLabel onClick={() => setShowAdvanced(!showAdvanced)} sx={{ textDecoration: 'underline', cursor: 'pointer' }}>
        {showAdvanced ? 'Hide Advanced' : 'Advanced'}
      </FormLabel>

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


// this will help with adding metadata to the models
const knownBases = [
  {
    id: 'gpt-4-32k-0613',
    label: 'GPT-4-32k (0613)',
    context: 32768,
    description: 'Largest context window for big problems',
  },
  {
    id: 'gpt-4',
    label: 'GPT-4',
    context: 8192,
    description: 'Insightful, big thinker, slower, pricey',
  },
  {
    id: 'gpt-3.5-turbo-16k',
    label: '3.5-Turbo-16k',
    context: 16384,
    description: 'Fair speed and smarts, large context',
  },
  {
    id: 'gpt-3.5-turbo',
    label: '3.5-Turbo',
    context: 4097,
    description: 'Fair speed and smarts',
  },
  {
    id: '',
    label: '?:',
    context: 4096,
    description: 'Unknown, please let us know the ID',
  },
];


function openAIModelToDLLM(model: OpenAI.Wire.Models.ModelDescription, source: DModelSource): DLLM<LLMOptionsOpenAI> {
  const base = knownBases.find(base => model.id.startsWith(base.id)) || knownBases[knownBases.length - 1];
  const suffix = model.id.slice(base.id.length).trim();
  const hidden = !suffix || suffix.startsWith('-03');
  return {
    id: `${source.id}-${model.id}`,
    label: base.label + (suffix ? ` (${suffix.replaceAll('-', ' ').trim()})` : ''),
    created: model.created,
    description: base.description,
    tags: [], // ['stream', 'chat'],
    contextTokens: base.context,
    hidden,
    sId: source.id,
    _source: source,
    options: {
      llmRef: model.id,
      llmTemperature: 0.5,
      llmResponseTokens: Math.round(base.context / 8),
    },
  };
}