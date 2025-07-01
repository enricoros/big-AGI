import * as React from 'react';

import { FormControl, Input, Option, Select, Slider } from '@mui/joy';
import FormatPaintTwoToneIcon from '@mui/icons-material/FormatPaintTwoTone';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { DEFAULT_PRODIA_RESOLUTION, HARDCODED_PRODIA_RESOLUTIONS, useProdiaStore } from './store-module-prodia';
import { PRODIA_HARDCODED_MODELS } from './prodia.models';


const STYLE_PRESETS = [
  '3d-model', 'analog-film', 'anime', 'cinematic', 'comic-book', 'digital-art',
  'enhance', 'fantasy-art', 'isometric', 'line-art', 'low-poly', 'neon-punk',
  'origami', 'photographic', 'pixel-art', 'texture', 'craft-clay',
];


export function ProdiaSettings(props: { noSkipKey?: boolean }) {

  // state
  const advanced = useToggleableBoolean(false, 'ProdiaSettings');

  // External state
  const backendHasProdia = getBackendCapabilities().hasImagingProdia;
  const {
    apiKey, setApiKey,
    modelId, setModelId,
    resolution, setResolution,
    negativePrompt, setNegativePrompt,
    fluxSteps, setFluxSteps,
    sdxlSteps, setSdxlSteps,
    setSdCfgScale, sdCfgScale,
    stylePreset, setStylePreset,
    seed, setSeed,
  } = useProdiaStore();

  // Get selected model info
  const selectedModel = PRODIA_HARDCODED_MODELS.find(model => model.id === modelId);

  // Determine which parameters to show
  const showNegativePrompt = selectedModel?.parameters?.includes('negative_prompt') ?? false;
  const showFluxSteps = selectedModel?.parameters?.includes('flux-steps') ?? false;
  const showSdxlSteps = selectedModel?.parameters?.includes('sdxl-steps') ?? false;
  const showCfgScale = selectedModel?.parameters?.includes('cfg_scale') ?? selectedModel?.parameters?.includes('guidance_scale') ?? false;
  const showStylePreset = selectedModel?.parameters?.includes('style_preset') ?? false;
  const supportsResolution = !selectedModel?.id.includes('txt2vid');


  return <>

    {!backendHasProdia && !!props.noSkipKey && (
      <FormInputKey
        autoCompleteId='prodia-key'
        label='Prodia API Key'
        placeholder='Enter your Prodia Bearer Token'
        rightLabel={<AlreadySet required={!backendHasProdia} />}
        value={apiKey}
        onChange={setApiKey}
        required={!backendHasProdia}
      />
    )}

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Model' />
      <Select
        variant='outlined'
        placeholder='Select a model'
        value={modelId}
        onChange={(_, value) => value && setModelId(value)}
        startDecorator={<FormatPaintTwoToneIcon sx={{ display: { xs: 'none', sm: 'inherit' } }} />}
        indicator={<KeyboardArrowDownIcon />}
      >
        {PRODIA_HARDCODED_MODELS.map((model) => (
          <Option key={model.id} value={model.id} sx={model.priority ? { fontWeight: 'md' } : undefined}>
            {model.label} {model.timeEstimate ? `(~${model.timeEstimate})` : ''}
          </Option>
        ))}
      </Select>
    </FormControl>

    {supportsResolution && (
      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title='Resolution' description='Image dimension' />
        <Select
          variant='outlined'
          value={resolution || DEFAULT_PRODIA_RESOLUTION}
          onChange={(_, value) => value && setResolution(value)}
        >
          {HARDCODED_PRODIA_RESOLUTIONS.map((res) => (
            <Option key={res} value={res}>
              {res.replace('x', ' × ')}
            </Option>
          ))}
        </Select>
      </FormControl>
    )}

    {showNegativePrompt && (
      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title='Negative Prompt' tooltip='Elements to avoid in the generated image' />
        <Input
          variant='outlined'
          placeholder='blurry, text, watermark...'
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          sx={{ width: '100%' }}
        />
      </FormControl>
    )}

    {(showFluxSteps || showSdxlSteps) && (
      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
        <FormLabelStart title='Steps' description='Number of iterations' />
        <Slider
          valueLabelDisplay='auto'
          value={showFluxSteps ? fluxSteps : sdxlSteps}
          onChange={(_, value) => showFluxSteps
            ? setFluxSteps(value as number)
            : setSdxlSteps(value as number)}
          step={1}
          min={showFluxSteps ? 1 : 5}
          max={showFluxSteps ? 4 : 50}
          marks={showFluxSteps ?
            [{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }] :
            [{ value: 5 }, { value: 25 }, { value: 50 }]
          }
          sx={{ maxWidth: '160px' }}
        />
      </FormControl>
    )}

    {showCfgScale && (
      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
        <FormLabelStart title='Guidance Scale' description='Prompt strength' />
        <Slider
          valueLabelDisplay='auto'
          value={sdCfgScale}
          onChange={(_, value) => setSdCfgScale(value as number)}
          min={selectedModel?.id.includes('kling') ? 0 : 1}
          max={selectedModel?.id.includes('kling') ? 1 : 15}
          step={selectedModel?.id.includes('kling') ? 0.1 : 0.5}
          sx={{ width: '100%' }}
        />
      </FormControl>
    )}

    {showStylePreset && (
      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title='Style' description='Apply a theme' />
        <Select
          variant='outlined'
          value={stylePreset || ''}
          onChange={(_, value) => setStylePreset(value)}
          placeholder='No preset'
          sx={{ width: '160px' }}
        >
          <Option value=''>No preset</Option>
          {STYLE_PRESETS.map((style) => (
            <Option key={style} value={style}>
              {style.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </Option>
          ))}
        </Select>
      </FormControl>
    )}

    {advanced.on && (
      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title='Seed' tooltip='Set specific seed for reproducible results. Leave empty for random.' />
        <Input
          variant='outlined'
          placeholder='Random'
          value={seed === null ? '' : String(seed)}
          onChange={(e) => setSeed(e.target.value)}
          type='number'
          sx={{ maxWidth: '160px' }}
        />
      </FormControl>
    )}

    <FormLabelStart
      title={advanced.on ? 'Hide Advanced' : 'Advanced'}
      onClick={advanced.toggle}
      sx={{ cursor: 'pointer', textDecoration: 'underline' }}
    />

  </>;
}