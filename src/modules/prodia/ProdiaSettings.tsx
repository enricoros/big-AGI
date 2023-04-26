import * as React from 'react';
import { shallow } from 'zustand/shallow';
import { useQuery } from '@tanstack/react-query';

import { Box, CircularProgress, FormControl, FormHelperText, FormLabel, IconButton, Input, Option, Select, Slider, Stack, Tooltip } from '@mui/joy';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyIcon from '@mui/icons-material/Key';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { Section } from '@/common/components/Section';
import { settingsGap } from '@/common/theme';
import { useSettingsStore } from '@/common/state/store-settings';

import { Prodia } from './prodia.types';
import { isValidProdiaApiKey, prodiaDefaultModelId, requireUserKeyProdia } from './prodia.client';


export function ProdiaSettings() {
  // state
  const [showApiKeyValue, setShowApiKeyValue] = React.useState(false);

  // external state
  const { apiKey, setApiKey, modelId, setModelId, negativePrompt, setNegativePrompt, cfgScale, setCfgScale, steps, setSteps, seed, setSeed } = useSettingsStore(state => ({
    apiKey: state.prodiaApiKey, setApiKey: state.setProdiaApiKey,
    modelId: state.prodiaModelId, setModelId: state.setProdiaModelId,
    negativePrompt: state.prodiaNegativePrompt, setNegativePrompt: state.setProdiaNegativePrompt,
    cfgScale: state.prodiaCfgScale, setCfgScale: state.setProdiaCfgScale,
    steps: state.prodiaSteps, setSteps: state.setProdiaSteps,
    seed: state.prodiaSeed, setSeed: state.setProdiaSeed,
  }), shallow);

  const requiresKey = requireUserKeyProdia;
  const isValidKey = apiKey ? isValidProdiaApiKey(apiKey) : !requiresKey;

  // load models, if the server has a key, or the user provided one
  const { data: modelsData, isLoading: loadingModels } = useQuery(['models', apiKey], {
    enabled: isValidKey,
    queryFn: () => fetch('/api/prodia/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(apiKey ? { apiKey: apiKey } : {}) }),
    }).then(res => res.json() as Promise<Prodia.API.Models.Response>),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleToggleApiKeyVisibility = () => setShowApiKeyValue(!showApiKeyValue);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value);

  const handleModelChange = (e: any, value: string | null) => value && setModelId(value);

  const colWidth = 150;

  return (
    <Section title='🎨 Image Generation' collapsible collapsed disclaimer='Supported image generators: Prodia.com' sx={{ mt: 2 }}>
      <Stack direction='column' sx={{ gap: settingsGap, mt: -0.8 }}>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box>
            <FormLabel sx={{ minWidth: colWidth }}>
              Prodia API Key
            </FormLabel>
            <FormHelperText>
              {requiresKey ? '(required)' : '(optional)'}
            </FormHelperText>
          </Box>
          <Input
            variant='outlined' type={showApiKeyValue ? 'text' : 'password'} placeholder={requiresKey ? 'required' : '...'} error={!isValidKey}
            value={apiKey} onChange={handleApiKeyChange}
            startDecorator={<KeyIcon />}
            endDecorator={!!apiKey && (
              <IconButton variant='plain' color='neutral' onClick={handleToggleApiKeyVisibility}>
                {showApiKeyValue ? <VisibilityIcon /> : <VisibilityOffIcon />}
              </IconButton>
            )}
            slotProps={{ input: { sx: { width: '100%' } } }}
            sx={{ width: '100%' }}
          />
        </FormControl>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <FormLabel sx={{ minWidth: colWidth }}>
            Diffusion Model
          </FormLabel>
          <Select
            variant='outlined' placeholder={isValidKey ? 'Select a model' : 'Enter API Key'}
            value={modelId || prodiaDefaultModelId} onChange={handleModelChange}
            startDecorator={<FormatPaintIcon />}
            endDecorator={isValidKey && loadingModels && <CircularProgress size='sm' />}
            indicator={<KeyboardArrowDownIcon />}
            slotProps={{
              root: { sx: { width: '100%' } },
              indicator: { sx: { opacity: 0.5 } },
            }}
          >
            {modelsData && modelsData.models?.map((model, idx) => (
              <Option key={'prodia-model-' + idx} value={model.id}>
                {model.label}
              </Option>
            ))}
          </Select>
        </FormControl>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box>
            <Tooltip title='Avoid these image traits: comma-separated names & adjectives that you want the images to Not have. Example: ugly, blurry, malformed'>
              <FormLabel sx={{ minWidth: colWidth }}>
                Negative Prompt <InfoOutlinedIcon sx={{ mx: 0.5 }} />
              </FormLabel>
            </Tooltip>
            <FormHelperText>
              {negativePrompt ? 'Custom' : 'Not set'}
            </FormHelperText>
          </Box>
          <Input
            aria-label='Image Generation Negative Prompt'
            variant='outlined' placeholder='ugly, blurry, ...'
            value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)}
            slotProps={{ input: { sx: { width: '100%' } } }}
            sx={{ width: '100%' }}
          />
        </FormControl>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box>
            <Tooltip title='More steps boost image detail & quality but risk oversaturation and cost increase. Start from 20 steps, and increase gradually. Defaults to 25.'>
              <FormLabel sx={{ minWidth: colWidth }}>
                Diffusion Steps <InfoOutlinedIcon sx={{ mx: 0.5 }} />
              </FormLabel>
            </Tooltip>
            <FormHelperText>
              {steps === 25 ? 'Default' : steps > 30 ? (steps > 40 ? 'May be unnecessary' : 'More detail') : steps <= 15 ? 'Less detail' : 'Balanced'}
            </FormHelperText>
          </Box>
          <Slider
            aria-label='Image Generation steps' valueLabelDisplay='auto'
            value={steps} onChange={(e, value) => setSteps(value as number)}
            min={10} max={50} step={1} defaultValue={25}
            sx={{ width: '100%' }}
          />
        </FormControl>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box>
            <Tooltip title='Adjust the prompt intensity for generation. Low values deviate, high values overfit. Default: 7 - a balanced start.'>
              <FormLabel sx={{ minWidth: colWidth }}>
                Cfg-Scale <InfoOutlinedIcon sx={{ mx: 0.5 }} />
              </FormLabel>
            </Tooltip>
            <FormHelperText>
              {cfgScale === 7 ? 'Default' : cfgScale >= 9 ? (cfgScale >= 12 ? 'Heavy guidance' : 'Intense guidance') : cfgScale <= 5 ? 'More freedom' : 'Balanced'}
            </FormHelperText>
          </Box>
          <Slider
            aria-label='Image Generation Guidance' valueLabelDisplay='auto'
            value={cfgScale} onChange={(e, value) => setCfgScale(value as number)}
            min={1} max={15} step={0.5} defaultValue={7}
            sx={{ width: '100%' }}
          />
        </FormControl>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box>
            <Tooltip title='Set value for reproducible images. Different by default.'>
              <FormLabel sx={{ minWidth: colWidth }}>
                Noise Seed <InfoOutlinedIcon sx={{ mx: 0.5 }} />
              </FormLabel>
            </Tooltip>
            <FormHelperText>
              {seed ? 'Custom' : 'Random'}
            </FormHelperText>
          </Box>
          <Input
            aria-label='Image Generation Seed'
            variant='outlined' placeholder='Random'
            value={seed || ''} onChange={(e) => setSeed(e.target.value || '')}
            slotProps={{
              input: {
                type: 'number',
                sx: { width: '100%' },
              },
            }}
            sx={{ width: '100%' }}
          />
        </FormControl>

      </Stack>
    </Section>
  );
}