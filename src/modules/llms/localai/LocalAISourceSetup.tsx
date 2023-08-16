import * as React from 'react';
import { z } from 'zod';

import { Box, Button, Typography } from '@mui/joy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SyncIcon from '@mui/icons-material/Sync';

import { apiQuery } from '~/modules/trpc/trpc.client';

import { FormInputKey } from '~/common/components/FormInputKey';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { settingsGap } from '~/common/theme';

import { LLMOptionsOpenAI, ModelVendorOpenAI } from '~/modules/llms/openai/openai.vendor';

import { DLLM, DModelSource, DModelSourceId } from '../llm.types';
import { ModelVendorLocalAI } from './localai.vendor';
import { useModelsStore, useSourceSetup } from '../store-llms';


const urlSchema = z.string().url().startsWith('http');


export function LocalAISourceSetup(props: { sourceId: DModelSourceId }) {

  // external state
  const {
    source, normSetup: { oaiHost }, updateSetup, sourceLLMs,
  } = useSourceSetup(props.sourceId, ModelVendorLocalAI.normalizeSetup);

  // validate if url is a well formed proper url with zod
  const { success: isValidHost } = urlSchema.safeParse(oaiHost);
  const shallFetchSucceed = isValidHost;

  const hasModels = !!sourceLLMs.length;

  // fetch models - the OpenAI way
  const { isFetching, refetch, isError, error } = apiQuery.llmOpenAI.listModels.useQuery({
    access: ModelVendorOpenAI.normalizeSetup({ oaiHost }),
  }, {
    enabled: false, //!sourceLLMs.length && shallFetchSucceed,
    onSuccess: models => {
      const llms = source ? models.map(model => localAIToDLLM(model, source)) : [];
      useModelsStore.getState().addLLMs(llms);
    },
    staleTime: Infinity,
  });

  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

    <Typography level='body-sm'>
      You can use a running <Link href='https://localai.io' target='_blank'>LocalAI</Link> instance as a source for local models.
      Please refer to the LocalAI website for how to get it setup and running with models, and then enter the URL below.
    </Typography>

    <FormInputKey
      required noKey
      label='LocalAI URL' rightLabel={<Link level='body-sm' href='https://localai.io' target='_blank'>Learn more</Link>}
      placeholder='e.g., http://127.0.0.1:8080'
      value={oaiHost} onChange={value => updateSetup({ oaiHost: value })}
    />

    <Button
      variant='solid' color={isError ? 'warning' : 'primary'}
      disabled={!shallFetchSucceed || isFetching}
      endDecorator={hasModels ? <SyncIcon /> : <FileDownloadIcon />}
      onClick={() => refetch()}
      sx={{ minWidth: 120, ml: 'auto' }}
    >
      Models
    </Button>

    {isError && <InlineError error={error} />}

  </Box>;
}

const NotChatModels: string[] = [];

const ModelHeuristics: { [key: string]: { label: string, contextTokens: number } } = {
  'ggml-gpt4all-j': {
    label: 'GPT4All-J',
    contextTokens: 2048,
  },
};


function localAIToDLLM(model: { id: string, object: 'model' }, source: DModelSource): DLLM<LLMOptionsOpenAI> {
  const h = ModelHeuristics[model.id] || {
    label: model.id
      .replace('ggml-', '')
      .replace('.bin', '')
      .replaceAll('-', ' '),
    contextTokens: 2048, // conservative default
  };
  return {
    id: `${source.id}-${model.id}`,
    label: h.label,
    created: 0,
    description: 'Local model',
    tags: [], // ['stream', 'chat'],
    contextTokens: h.contextTokens,
    hidden: NotChatModels.includes(model.id),
    sId: source.id,
    _source: source,
    options: {
      llmRef: model.id,
      llmTemperature: 0.5,
      llmResponseTokens: Math.round(h.contextTokens / 8),
    },
  };
}