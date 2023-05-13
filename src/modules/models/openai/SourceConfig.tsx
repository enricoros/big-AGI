import * as React from 'react';

import { Box, FormControl, FormHelperText, FormLabel, Input, Slider, Stack } from '@mui/joy';

import { hasServerKeyOpenAI, isValidOpenAIApiKey } from '@/modules/openai/openai.client';

import { Brand } from '@/common/brand';
import { FormInputKey } from '@/common/components/FormInputKey';
import { Link } from '@/common/components/Link';
import { Section } from '@/common/components/Section';
import { settingsCol1Width, settingsGap, settingsMaxWidth } from '@/common/theme';

import { DModelSourceId, useSourceConfigurator } from '../store-models';
import { normConfigOpenAI, SourceConfigOpenAI } from './vendor';


export function SourceConfig(props: { sourceId: DModelSourceId }) {

  // external state
  const {
    config: { heliKey, llmResponseTokens, llmTemperature, oaiHost, oaiKey, oaiOrg },
    update,
  } = useSourceConfigurator<SourceConfigOpenAI>(props.sourceId, normConfigOpenAI);

  const needsKey = !hasServerKeyOpenAI;

  const keyError = (/*needsKey ||*/ !!oaiKey) && !isValidOpenAIApiKey(oaiKey);

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

  </Box>;
}