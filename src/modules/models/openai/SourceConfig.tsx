import * as React from 'react';

import { Box, Button, FormControl, FormHelperText, FormLabel, Input, Slider, Stack } from '@mui/joy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

import { OpenAI } from '~/modules/openai/openai.types';
import { api } from '~/modules/trpc/trpc.client';
import { hasServerKeyOpenAI, isValidOpenAIApiKey } from '~/modules/openai/openai.client';

import { Brand } from '~/common/brand';
import { FormInputKey } from '~/common/components/FormInputKey';
import { Link } from '~/common/components/Link';
import { Section } from '~/common/components/Section';
import { settingsCol1Width, settingsGap, settingsMaxWidth } from '~/common/theme';

import { DLLM, DModelSourceId, useModelsStore, useSourceConfigurator } from '../store-models';
import { normConfigOpenAI, SourceConfigOpenAI } from './vendor';


export function SourceConfig(props: { sourceId: DModelSourceId }) {

  // external state
  const {
    config: { heliKey, llmResponseTokens, llmTemperature, oaiHost, oaiKey, oaiOrg },
    update,
  } = useSourceConfigurator<SourceConfigOpenAI>(props.sourceId, normConfigOpenAI);
  const llmsCount = useModelsStore(state => state.llms.length);

  const keyError = (/*needsKey ||*/ !!oaiKey) && !isValidOpenAIApiKey(oaiKey);
  const needsKey = !hasServerKeyOpenAI;
  const shallFetchSucceed = oaiKey ? isValidOpenAIApiKey(oaiKey) : !needsKey;

  // fetch models
  const { isFetching, refetch } = api.openai.listModels.useQuery({ oaiKey, oaiHost, oaiOrg, heliKey }, {
    enabled: !llmsCount && shallFetchSucceed,
    onSuccess: models => {
      const llms = models.map(model => openAIModelToDLLM(model, props.sourceId));
      useModelsStore.getState().addLLMs(llms);
    },
    staleTime: Infinity,
  });


  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

    <FormInputKey
      label={'OpenAI API Key' + (needsKey ? '' : ' (not required)')}
      value={oaiKey} onChange={value => update({ oaiKey: value })}
      required={needsKey} isError={keyError}
      placeholder='sk-...'
      description={<>
        {needsKey
          ? <>
            <Link level='body2' href='https://platform.openai.com/account/api-keys' target='_blank'>Create Key</Link>, then apply to
            the <Link level='body2' href='https://openai.com/waitlist/gpt-4-api' target='_blank'>GPT-4 wait-list</Link>
          </>
          : `This key will take precedence over the server's.`}
        {' '}<Link level='body2' href='https://platform.openai.com/account/usage' target='_blank'>Check usage here</Link>.
      </>} />


    <Section title='Advanced' collapsible collapsed asLink>

      <Stack direction='column' sx={{ ml: 'auto', gap: settingsGap, maxWidth: settingsMaxWidth }}>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ minWidth: settingsCol1Width }}>
            <FormLabel>Temperature</FormLabel>
            <FormHelperText>{llmTemperature < 0.33 ? 'More strict' : llmTemperature > 0.67 ? 'Larger freedom' : 'Creativity'}</FormHelperText>
          </Box>
          <Slider
            aria-label='Model Temperature' color='neutral'
            min={0} max={1} step={0.1} defaultValue={0.5}
            value={llmTemperature} onChange={(event, value) => update({ llmTemperature: value as number })}
            valueLabelDisplay='on'
            sx={{ py: 1, mt: 1.1 }}
          />
        </FormControl>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ minWidth: settingsCol1Width }}>
            <FormLabel>Max Tokens</FormLabel>
            <FormHelperText>Response size</FormHelperText>
          </Box>
          <Slider
            aria-label='Model Max Tokens' color='neutral'
            min={256} max={4096} step={256} defaultValue={1024}
            value={llmResponseTokens} onChange={(event, value) => update({ llmResponseTokens: value as number })}
            valueLabelDisplay='on'
            sx={{ py: 1, mt: 1.1 }}
          />
        </FormControl>

        <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Box sx={{ minWidth: settingsCol1Width }}>
            <FormLabel>
              Organization ID
            </FormLabel>
            <FormHelperText sx={{ display: 'block' }}>
              <Link level='body2' href={`${Brand.URIs.OpenRepo}/issues/63`} target='_blank'>What is this</Link>
            </FormHelperText>
          </Box>
          <Input
            variant='outlined' placeholder='Optional, for org users'
            value={oaiOrg} onChange={event => update({ oaiOrg: event.target.value })}
            sx={{ flexGrow: 1 }}
          />
        </FormControl>

        <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Box sx={{ minWidth: settingsCol1Width }}>
            <FormLabel>
              API Host
            </FormLabel>
            <FormHelperText sx={{ display: 'block' }}>
              <Link level='body2' href='https://www.helicone.ai' target='_blank'>Helicone</Link>, ...
            </FormHelperText>
          </Box>
          <Input
            variant='outlined' placeholder='e.g., oai.hconeai.com'
            value={oaiHost} onChange={event => update({ oaiHost: event.target.value })}
            sx={{ flexGrow: 1 }}
          />
        </FormControl>

        <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Box sx={{ minWidth: settingsCol1Width }}>
            <FormLabel>
              Helicone Key
            </FormLabel>
            <FormHelperText sx={{ display: 'block' }}>
              Generate <Link level='body2' href='https://www.helicone.ai/keys' target='_blank'>here</Link>
            </FormHelperText>
          </Box>
          <Input
            variant='outlined' placeholder='sk-...'
            value={heliKey} onChange={event => update({ heliKey: event.target.value })}
            sx={{ flexGrow: 1 }}
          />
        </FormControl>

      </Stack>

    </Section>

    <Box>
      <Button
        variant='solid' color='neutral'
        disabled={!shallFetchSucceed || isFetching}
        endDecorator={<FileDownloadIcon />}
        onClick={() => refetch()}
        sx={{ minWidth: 120 }}
      >
        Models
      </Button>
    </Box>

  </Box>;
}


function openAIModelToDLLM(model: OpenAI.Wire.Models.ModelDescription, sourceId: DModelSourceId): DLLM {
  const id = model.id;
  const family: '4-32' | '4' | '3.5' | 'unknown' = id.startsWith('gpt-4-32k') ? '4-32' : id.startsWith('gpt-4') ? '4' : id.startsWith('gpt-3.5') ? '3.5' : 'unknown';
  let label: string;
  let contextWindowSize: number;
  let description: string;
  switch (family) {
    case '4-32':
      label = 'GPT-4-32' + id.replace('gpt-4-32k', '');
      contextWindowSize = 32768;
      description = 'Largest context window for large scale problems';
      break;
    case '4':
      label = 'GPT-4' + id.replace('gpt-4', '');
      contextWindowSize = 8192;
      description = 'Most insightful, larger problems, but slow, pricey';
      break;
    case '3.5':
      label = '3.5' + id.replace('gpt-3.5', '');
      contextWindowSize = 4097;
      description = 'A good balance between speed and insight';
      break;
    default:
      label = id.toUpperCase() + '?';
      contextWindowSize = 4000;
      description = `Unknown model ${id}`;
      break;
  }
  return {
    uid: `${sourceId}-${id}`,
    _sourceId: sourceId,
    _sourceModelId: id,
    label,
    contextWindowSize,
    canStream: true,
    canChat: true,
    description,
    created: model.created,
  };
}