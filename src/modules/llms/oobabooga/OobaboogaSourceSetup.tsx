import * as React from 'react';

import { Alert, Box, Button, FormControl, FormHelperText, FormLabel, Input, Typography } from '@mui/joy';
import SyncIcon from '@mui/icons-material/Sync';

import { apiQuery } from '~/modules/trpc/trpc.client';

import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { settingsCol1Width, settingsGap } from '~/common/theme';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '~/modules/llms/openai/openai.vendor';
import { OpenAI } from '~/modules/llms/openai/openai.types';

import { DLLM, DModelSource, DModelSourceId } from '../llm.types';
import { ModelVendorOoobabooga } from './oobabooga.vendor';
import { useModelsStore, useSourceSetup } from '../store-llms';


export function OobaboogaSourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const {
    source, sourceLLMs, updateSetup, normSetup,
  } = useSourceSetup(props.sourceId, ModelVendorOoobabooga.normalizeSetup);

  // fetch models - the OpenAI way
  const { isFetching, refetch, isError, error } = apiQuery.llmOpenAI.listModels.useQuery({
    access: ModelVendorOpenAI.normalizeSetup(normSetup),
  }, {
    enabled: false, //!hasModels && !!asValidURL(normSetup.oaiHost),
    onSuccess: (models) => {
      const llms: DLLM[] = [];
      if (source && models) {
        for (const model of models) {
          const llm = oobaboogaModelToDLLM(model, source);
          if (llm)
            llms.push(llm);
        }
      }
      useModelsStore.getState().addLLMs(llms);
    },
    staleTime: Infinity,
  });

  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

    <Typography level='body-sm'>
      You can use a running <Link href='https://github.com/oobabooga/text-generation-webui' target='_blank'>
      text-generation-webui</Link> instance as a source for local models.
      Follow <Link href='https://github.com/enricoros/big-agi/blob/main/docs/local-llm-text-web-ui.md' target='_blank'>
      the instructions</Link> to set up the server.
    </Typography>

    <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: settingsCol1Width }}>
        <FormLabel>
          API Base
        </FormLabel>
        <FormHelperText sx={{ display: 'block' }}>
          Excluding /v1
        </FormHelperText>
      </Box>
      <Input
        variant='outlined' placeholder='http://127.0.0.1:5001'
        value={normSetup.oaiHost} onChange={event => updateSetup({ oaiHost: event.target.value })}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>

    {sourceLLMs.length > 0 && <Alert variant='soft' color='warning'>
      Success! Note The active model must be selected on the Oobabooga server, as it does not support switching models via API.
      Concurrent model execution is also not supported.
    </Alert>}

    <Box sx={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between' }}>
      <Button
        variant='solid' color={isError ? 'warning' : 'primary'}
        disabled={!(normSetup.oaiHost.length >= 7) || isFetching}
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

const NotChatModels: string[] = [
  'text-curie-001', 'text-davinci-002', 'all-mpnet-base-v2', 'gpt-3.5-turbo', 'text-embedding-ada-002',
];


function oobaboogaModelToDLLM(model: OpenAI.Wire.Models.ModelDescription, source: DModelSource): DLLM<LLMOptionsOpenAI> | null {
  // if the model id is one of NotChatModels, we don't want to show it
  if (NotChatModels.includes(model.id))
    return null;
  let label = model.id.replaceAll(/[_-]/g, ' ').split(' ').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  if (label.endsWith('.bin'))
    label = label.slice(0, -4);
  // TODO - figure out how to the context window size from Oobabooga
  const contextTokens = 4096;
  return {
    id: `${source.id}-${model.id}`,
    label,
    created: model.created || Math.round(Date.now() / 1000),
    description: 'Oobabooga model',
    tags: [], // ['stream', 'chat'],
    contextTokens,
    hidden: NotChatModels.includes(model.id),
    sId: source.id,
    _source: source,
    options: {
      llmRef: model.id,
      llmTemperature: 0.5,
      llmResponseTokens: Math.round(contextTokens / 8),
    },
  };
}