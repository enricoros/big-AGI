import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Chip, CircularProgress, FormControl, Input, Option, Select, Slider, Switch } from '@mui/joy';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import FormatPaintTwoToneIcon from '@mui/icons-material/FormatPaintTwoTone';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import StayPrimaryLandscapeIcon from '@mui/icons-material/StayPrimaryLandscape';
import StayPrimaryPortraitIcon from '@mui/icons-material/StayPrimaryPortrait';

import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import { AlreadySet } from '~/common/components/AlreadySet';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormRadioControl } from '~/common/components/forms/FormRadioControl';
import { InlineError } from '~/common/components/InlineError';
import { apiQuery } from '~/common/util/trpc.client';
import { useToggleableBoolean } from '~/common/util/useToggleableBoolean';

import { DEFAULT_PRODIA_RESOLUTION, HARDCODED_PRODIA_RESOLUTIONS, useProdiaStore } from './store-module-prodia';


const isValidProdiaApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 36;


export function ProdiaSettings(props: { noSkipKey?: boolean }) {

  // state
  const advanced = useToggleableBoolean(false, 'ProdiaSettings');

  // external state
  const backendHasProdia = getBackendCapabilities().hasImagingProdia;
  const { apiKey, setApiKey, modelId, setModelId, modelGen, setModelGen, negativePrompt, setNegativePrompt, steps, setSteps, cfgScale, setCfgScale, prodiaAspectRatio, setProdiaAspectRatio, upscale, setUpscale, prodiaResolution, setProdiaResolution, seed, setSeed } = useProdiaStore(state => ({
    apiKey: state.prodiaApiKey, setApiKey: state.setProdiaApiKey,
    modelId: state.prodiaModelId, setModelId: state.setProdiaModelId,
    modelGen: state.prodiaModelGen, setModelGen: state.setProdiaModelGen,
    negativePrompt: state.prodiaNegativePrompt, setNegativePrompt: state.setProdiaNegativePrompt,
    steps: state.prodiaSteps, setSteps: state.setProdiaSteps,
    cfgScale: state.prodiaCfgScale, setCfgScale: state.setProdiaCfgScale,
    prodiaAspectRatio: state.prodiaAspectRatio, setProdiaAspectRatio: state.setProdiaAspectRatio,
    upscale: state.prodiaUpscale, setUpscale: state.setProdiaUpscale,
    prodiaResolution: state.prodiaResolution, setProdiaResolution: state.setProdiaResolution,
    seed: state.prodiaSeed, setSeed: state.setProdiaSeed,
  }), shallow);


  // derived state
  const isValidKey = apiKey ? isValidProdiaApiKey(apiKey) : backendHasProdia;
  const selectedIsXL = modelGen === 'sdxl';

  // load models, if the server has a key, or the user provided one
  const { data: modelsData, isLoading: loadingModels, isError, error } = apiQuery.prodia.listModels.useQuery({ prodiaKey: apiKey }, {
    enabled: isValidKey,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // [effect] if no model is selected, auto-select the first
  React.useEffect(() => {
    if (modelsData?.models && !modelId) {
      setModelId(modelsData.models[0].id);
      setModelGen(modelsData.models[0].gen);
    }
  }, [modelsData, modelId, setModelId, setModelGen]);


  const handleModelChange = (_event: any, value: string | null) => {
    if (value) {
      const prodiaModel = modelsData?.models?.find(model => model.id === value) ?? null;
      if (prodiaModel) {
        setModelId(prodiaModel.id);
        setModelGen(prodiaModel.gen);
      }
    }
  };

  const handleResolutionChange = (_event: any, value: string | null) => value && setProdiaResolution(value);


  return <>

    {!backendHasProdia && !!props.noSkipKey && <FormInputKey
      autoCompleteId='prodia-key' label='Prodia API Key'
      rightLabel={<AlreadySet required={!backendHasProdia} />}
      value={apiKey} onChange={setApiKey}
      required={!backendHasProdia} isError={!isValidKey}
    />}

    {isError && <InlineError error={error} />}

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Diffusion Model' />
      <Select
        variant='outlined' placeholder={isValidKey ? 'Select a model' : 'Enter API Key'}
        value={modelId} onChange={handleModelChange}
        startDecorator={<FormatPaintTwoToneIcon sx={{ display: { xs: 'none', sm: 'inherit' } }} />}
        endDecorator={isValidKey && loadingModels && <CircularProgress size='sm' />}
        indicator={<KeyboardArrowDownIcon />}
        slotProps={{
          root: { sx: { width: '100%' } },
          indicator: { sx: { opacity: 0.5 } },
          button: { sx: { whiteSpace: 'inherit' } },
        }}
      >
        {!!modelsData && modelsData.models?.map((model, idx) => (
          <Option key={'prodia-model-' + idx} value={model.id} sx={model.priority ? { fontWeight: 'md' } : undefined}>
            {model.gen === 'sdxl' && <Chip size='sm' variant='outlined'>XL</Chip>} {model.label}
          </Option>
        ))}
      </Select>
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Negative Prompt'
                      description={negativePrompt ? 'Custom' : 'Not set'}
                      tooltip='Avoid these image traits: comma-separated names & adjectives that you want the images to Not have. Example: ugly, blurry, malformed' />
      <Input
        aria-label='Image Generation Negative Prompt'
        variant='outlined' placeholder='ugly, blurry, ...'
        value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)}
        slotProps={{ input: { sx: { width: '100%' } } }}
        sx={{ width: '100%' }}
      />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Diffusion Steps'
                      description={steps === 25 ? 'Default' : steps > 30 ? (steps > 40 ? 'May be unnecessary' : 'More detail') : steps <= 15 ? 'Less detail' : 'Balanced'}
                      tooltip='More steps boost image detail & quality but risk oversaturation and cost increase. Start from 20 steps, and increase gradually. Defaults to 25.' />
      <Slider
        aria-label='Image Generation steps' valueLabelDisplay='auto'
        value={steps} onChange={(_event, value) => setSteps(value as number)}
        min={10} max={50} step={1} defaultValue={25}
        sx={{ width: '100%' }}
      />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Cfg-Scale'
                      description={cfgScale === 7 ? 'Default' : cfgScale >= 9 ? (cfgScale >= 12 ? 'Heavy guidance' : 'Intense guidance') : cfgScale <= 5 ? 'More freedom' : 'Balanced'}
                      tooltip='Adjust the prompt intensity for generation. Low values deviate, high values overfit. Default: 7 - a balanced start.' />
      <Slider
        aria-label='Image Generation Guidance' valueLabelDisplay='auto'
        value={cfgScale} onChange={(_event, value) => setCfgScale(value as number)}
        min={1} max={15} step={0.5} defaultValue={7}
        sx={{ width: '100%' }}
      />
    </FormControl>

    {advanced.on && selectedIsXL && <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='[SDXL] Resolution' />
      <Select
        variant='outlined'
        value={prodiaResolution || DEFAULT_PRODIA_RESOLUTION} onChange={handleResolutionChange}
        // indicator={<KeyboardArrowDownIcon />}
        slotProps={{
          root: { sx: { width: '100%' } },
          indicator: { sx: { opacity: 0.5 } },
          button: { sx: { whiteSpace: 'inherit' } },
        }}
      >
        {HARDCODED_PRODIA_RESOLUTIONS.map((resolution) => (
          <Option key={'sdxl-res-' + resolution} value={resolution}>
            {resolution.replace('x', ' x ')}
          </Option>
        ))}
      </Select>
    </FormControl>}

    {advanced.on && !selectedIsXL && <FormRadioControl
      title='[SD] Aspect Ratio'
      description={prodiaAspectRatio === 'square' ? 'Square' : prodiaAspectRatio === 'portrait' ? 'Portrait' : 'Landscape'}
      options={[
        { value: 'square', label: <CropSquareIcon sx={{ width: 25, height: 24, mt: -0.25 }} /> },
        { value: 'portrait', label: <StayPrimaryPortraitIcon sx={{ width: 25, height: 24, mt: -0.25 }} /> },
        { value: 'landscape', label: <StayPrimaryLandscapeIcon sx={{ width: 25, height: 24, mt: -0.25 }} /> },
      ]}
      value={prodiaAspectRatio} onChange={setProdiaAspectRatio}
    />}

    {advanced.on && !selectedIsXL && <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='[SD] Upscale'
                      description={upscale ? '1024px' : 'Default'} />
      <Switch checked={upscale} onChange={(e) => setUpscale(e.target.checked)}
              endDecorator={upscale ? '2x' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>}

    {advanced.on && <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Noise Seed'
                      description={seed ? 'Custom' : 'Random'}
                      tooltip='Set value for reproducible images. Different by default.' />
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
    </FormControl>}

    <FormLabelStart title={advanced.on ? 'Hide Advanced' : 'Advanced'} onClick={advanced.toggle} />

  </>;
}