import * as React from 'react';

import { Box, FormControl, FormHelperText, FormLabel, Slider } from '@mui/joy';
import { settingsCol1Width, settingsGap } from '~/common/app.theme';

import { DLLM, useModelsStore } from '../../store-llms';
import { LLMOptionsOpenAI } from './openai.vendor';

function normalizeOpenAIOptions(partialOptions?: Partial<LLMOptionsOpenAI>) {
  return {
    llmRef: 'unknown_id',
    llmTemperature: 0.5,
    llmResponseTokens: 1024,
    ...partialOptions,
  };
}


export function OpenAILLMOptions(props: { llm: DLLM<unknown, LLMOptionsOpenAI> }) {

  const { id: llmId, maxOutputTokens, options } = props.llm;
  const { llmResponseTokens, llmTemperature } = normalizeOpenAIOptions(options);

  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: settingsCol1Width }}>
        <FormLabel>Temperature</FormLabel>
        <FormHelperText>{llmTemperature < 0.33 ? 'More strict' : llmTemperature > 0.67 ? 'Larger freedom' : 'Creativity'}</FormHelperText>
      </Box>
      <Slider
        aria-label='Model Temperature' color='neutral'
        min={0} max={1} step={0.1} defaultValue={0.5}
        value={llmTemperature} onChange={(_event, value) => useModelsStore.getState().updateLLMOptions(llmId, { llmTemperature: value as number })}
        valueLabelDisplay='auto'
        sx={{ py: 1, mt: 1.1 }}
      />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: settingsCol1Width }}>
        <FormLabel>Output Tokens</FormLabel>
        <FormHelperText>Reduces input</FormHelperText>
      </Box>
      <Slider
        aria-label='Model Max Tokens' color='neutral'
        min={256} max={maxOutputTokens} step={256} defaultValue={1024}
        value={llmResponseTokens} onChange={(_event, value) => useModelsStore.getState().updateLLMOptions(llmId, { llmResponseTokens: value as number })}
        valueLabelDisplay='on'
        sx={{ py: 1, mt: 1.1 }}
      />
    </FormControl>

  </Box>;
}