import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Button, CircularProgress, FormControl, FormHelperText, FormLabel, IconButton, Input, Modal, ModalClose, ModalDialog, ModalOverflow, Option, Radio, RadioGroup, Select, Slider, Stack, Switch, Tooltip, Typography } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyIcon from '@mui/icons-material/Key';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import WidthNormalIcon from '@mui/icons-material/WidthNormal';
import WidthWideIcon from '@mui/icons-material/WidthWide';

import languages from '@/lib/languages.json' assert { type: 'json' };
import { ElevenLabs } from '@/types/api-elevenlabs';
import { OpenAIAdvancedSettings } from '@/lib/modules/openai/OpenAIAdvancedSettings';
import { OpenAISettings } from '@/lib/modules/openai/OpenAISettings';
import { Prodia } from '@/types/api-prodia';
import { prodiaDefaultModelId } from '@/lib/llm/imagine';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '@/lib/stores/store-settings';


export const uniformGap: number = 2;
export const settingsCol1Width: number = 150;
export const settingsMaxWidth: number = 500;
export const hideOnMobile = { display: { xs: 'none', md: 'flex' } };
export const hideOnDesktop = { display: { xs: 'flex', md: 'none' } };


export const requireUserKeyElevenLabs = !process.env.HAS_SERVER_KEY_ELEVENLABS;

export const requireUserKeyProdia = !process.env.HAS_SERVER_KEY_PRODIA;


export const isValidElevenLabsApiKey = (apiKey?: string) =>
  !!apiKey && apiKey.trim()?.length >= 32;

export const isValidProdiaApiKey = (apiKey?: string) =>
  !!apiKey && apiKey.trim()?.length >= 36;


export function Section(props: { title?: string; collapsible?: boolean, collapsed?: boolean, disclaimer?: string, sx?: SxProps, children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(props.collapsed ?? false);

  return <>

    <Stack direction='row' sx={{ mt: (props.title ? 1 : 0), alignItems: 'center', ...(props.sx ?? {}) }}>
      {!!props.title && (
        <FormLabel>
          {props.title}
        </FormLabel>
      )}
      {!!props.collapsible && (
        <IconButton size='md' variant='plain' color='neutral' onClick={() => setCollapsed(!collapsed)} sx={{ ml: 1 }}>
          {!collapsed ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
        </IconButton>
      )}
    </Stack>

    {!collapsed && <Box sx={{ mt: 1.5, mb: 1.5 }}>
      {props.children}
    </Box>}

    {!!props.disclaimer && !collapsed && (
      <FormHelperText>
        {props.disclaimer}
      </FormHelperText>
    )}

  </>;
}

function LanguageSelect() {
  // external state
  const { preferredLanguage, setPreferredLanguage } = useSettingsStore(state => ({ preferredLanguage: state.preferredLanguage, setPreferredLanguage: state.setPreferredLanguage }), shallow);

  const handleLanguageChanged = (event: any, newValue: string | null) => {
    if (!newValue) return;
    setPreferredLanguage(newValue as string);

    // NOTE: disabled, to make sure the code can be adapted at runtime - will re-enable to trigger translations, if not dynamically switchable
    //if (typeof window !== 'undefined')
    //  window.location.reload();
  };

  const languageOptions = React.useMemo(() => Object.entries(languages).map(([language, localesOrCode]) =>
    typeof localesOrCode === 'string'
      ? (
        <Option key={localesOrCode} value={localesOrCode}>
          {language}
        </Option>
      ) : (
        Object.entries(localesOrCode).map(([country, code]) => (
          <Option key={code} value={code}>
            {`${language} (${country})`}
          </Option>
        ))
      )), []);

  return (
    <Select value={preferredLanguage} onChange={handleLanguageChanged}
            indicator={<KeyboardArrowDownIcon />}
            slotProps={{
              root: { sx: { minWidth: 200 } },
              indicator: { sx: { opacity: 0.5 } },
            }}>
      {languageOptions}
    </Select>
  );
}

function UISettings() {
  // external state
  const {
    centerMode, setCenterMode,
    renderMarkdown, setRenderMarkdown,
    showPurposeFinder, setShowPurposeFinder,
    zenMode, setZenMode,
  } = useSettingsStore(state => ({
    centerMode: state.centerMode, setCenterMode: state.setCenterMode,
    renderMarkdown: state.renderMarkdown, setRenderMarkdown: state.setRenderMarkdown,
    showPurposeFinder: state.showPurposeFinder, setShowPurposeFinder: state.setShowPurposeFinder,
    zenMode: state.zenMode, setZenMode: state.setZenMode,
  }), shallow);

  const handleCenterModeChange = (event: React.ChangeEvent<HTMLInputElement>) => setCenterMode(event.target.value as 'narrow' | 'wide' | 'full' || 'wide');

  const handleZenModeChange = (event: React.ChangeEvent<HTMLInputElement>) => setZenMode(event.target.value as 'clean' | 'cleaner');

  const handleRenderMarkdownChange = (event: React.ChangeEvent<HTMLInputElement>) => setRenderMarkdown(event.target.checked);

  const handleShowSearchBarChange = (event: React.ChangeEvent<HTMLInputElement>) => setShowPurposeFinder(event.target.checked);

  return (
    <Section>
      <Stack direction='column' sx={{ gap: uniformGap }}>

        <FormControl orientation='horizontal' sx={{ ...hideOnMobile, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <FormLabel>Centering</FormLabel>
            <FormHelperText>{centerMode === 'full' ? 'Full screen' : centerMode === 'narrow' ? 'Narrow' : 'Wide'} chat</FormHelperText>
          </Box>
          <RadioGroup orientation='horizontal' value={centerMode} onChange={handleCenterModeChange}>
            <Radio value='narrow' label={<WidthNormalIcon sx={{ width: 25, height: 24, mt: -0.25 }} />} />
            <Radio value='wide' label={<WidthWideIcon sx={{ width: 25, height: 24, mt: -0.25 }} />} />
            <Radio value='full' label='Full' />
          </RadioGroup>
        </FormControl>

        <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <FormLabel>Appearance</FormLabel>
            <FormHelperText>{zenMode === 'clean' ? 'Show senders' : 'Hide senders and menus'}</FormHelperText>
          </Box>
          <RadioGroup orientation='horizontal' value={zenMode} onChange={handleZenModeChange}>
            {/*<Radio value='clean' label={<Face6Icon sx={{ width: 24, height: 24, mt: -0.25 }} />} />*/}
            <Radio value='clean' label='Clean' />
            <Radio value='cleaner' label='Empty' />
          </RadioGroup>
        </FormControl>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box>
            <FormLabel>Markdown</FormLabel>
            <FormHelperText>{renderMarkdown ? 'Render markdown' : 'Text only'}</FormHelperText>
          </Box>
          <Switch checked={renderMarkdown} onChange={handleRenderMarkdownChange}
                  endDecorator={renderMarkdown ? 'On' : 'Off'}
                  slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
        </FormControl>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box>
            <FormLabel>Purpose finder</FormLabel>
            <FormHelperText>{showPurposeFinder ? 'Show search bar' : 'Hide search bar'}</FormHelperText>
          </Box>
          <Switch checked={showPurposeFinder} onChange={handleShowSearchBarChange}
                  endDecorator={showPurposeFinder ? 'On' : 'Off'}
                  slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
        </FormControl>

        <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Tooltip title='Currently for Microphone input only. Language support varies by browser. Note: iPhone/Safari lacks speech input.'>
              <FormLabel>
                Language <InfoOutlinedIcon sx={{ mx: 0.5 }} />
              </FormLabel>
            </Tooltip>
            <FormHelperText>
              Speech input
            </FormHelperText>
          </Box>
          <LanguageSelect />
        </FormControl>

      </Stack>
    </Section>
  );
}

function ElevenLabsSection() {
  // state
  const [showApiKeyValue, setShowApiKeyValue] = React.useState(false);

  // external state
  const { apiKey, setApiKey, voiceId, setVoiceId, autoSpeak, setAutoSpeak } = useSettingsStore(state => ({
    apiKey: state.elevenLabsApiKey, setApiKey: state.setElevenLabsApiKey,
    voiceId: state.elevenLabsVoiceId, setVoiceId: state.setElevenLabsVoiceId,
    autoSpeak: state.elevenLabsAutoSpeak, setAutoSpeak: state.setElevenLabsAutoSpeak,
  }), shallow);

  const requiresKey = requireUserKeyElevenLabs;
  const isValidKey = apiKey ? isValidElevenLabsApiKey(apiKey) : !requiresKey;

  // load voices, if the server has a key, or the user provided one
  const { data: voicesData, isLoading: loadingVoices } = useQuery(['voices', apiKey], {
    enabled: isValidKey,
    queryFn: () => fetch('/api/elevenlabs/voices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(apiKey ? { apiKey: apiKey } : {}) }),
    }).then(res => res.json() as Promise<ElevenLabs.API.Voices.Response>),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleToggleApiKeyVisibility = () => setShowApiKeyValue(!showApiKeyValue);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value);

  const handleVoiceChange = (e: any, value: string | null) => setVoiceId(value || '');

  const handleAutoSpeakChange = (e: React.ChangeEvent<HTMLInputElement>) => setAutoSpeak((e.target.value || 'off') as 'off' | 'firstLine');

  const colWidth = 150;

  return (
    <Section title='📢 Voice Generation' collapsible collapsed>
      <Stack direction='column' sx={{ gap: uniformGap, mt: -0.8 }}>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box>
            <FormLabel sx={{ minWidth: colWidth }}>
              ElevenLabs API Key
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
            Assistant voice
          </FormLabel>
          <Select
            variant='outlined' placeholder={isValidKey ? 'Select a voice' : 'Enter API Key'}
            value={voiceId} onChange={handleVoiceChange}
            startDecorator={<RecordVoiceOverIcon />}
            endDecorator={isValidKey && loadingVoices && <CircularProgress size='sm' />}
            indicator={<KeyboardArrowDownIcon />}
            slotProps={{
              root: { sx: { width: '100%' } },
              indicator: { sx: { opacity: 0.5 } },
            }}
          >
            {voicesData && voicesData.voices?.map(voice => (
              <Option key={voice.id} value={voice.id}>
                {voice.name}
              </Option>
            ))}
          </Select>
        </FormControl>

        <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <FormLabel>Speak responses</FormLabel>
            <FormHelperText>{autoSpeak === 'off' ? 'Off' : 'Just the first line'}</FormHelperText>
          </Box>
          <RadioGroup orientation='horizontal' value={autoSpeak} onChange={handleAutoSpeakChange}>
            <Radio value='off' label='Off' />
            <Radio value='firstLine' label='Beginning' />
          </RadioGroup>
        </FormControl>

      </Stack>
    </Section>
  );
}

function ProdiaSection() {
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
      <Stack direction='column' sx={{ gap: uniformGap, mt: -0.8 }}>

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


/**
 * Component that allows the User to modify the application settings,
 * persisted on the client via localStorage.
 *
 * @param {boolean} open Whether the Settings modal is open
 * @param {() => void} onClose Call this to close the dialog from outside
 */
export function SettingsModal({ open, onClose }: { open: boolean, onClose: () => void; }) {
  return (
    <Modal open={open} onClose={onClose}>
      <ModalOverflow>
        <ModalDialog sx={{ maxWidth: 500, display: 'flex', p: { xs: 1, sm: 2, lg: '20px' } }}>

          <Typography level='h6' sx={{ mb: 2 }}>Settings</Typography>
          <ModalClose />

          <OpenAISettings />

          <UISettings />

          <ElevenLabsSection />

          <ProdiaSection />

          <OpenAIAdvancedSettings />

          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant='solid' onClick={onClose}>
              Close
            </Button>
          </Box>

        </ModalDialog>
      </ModalOverflow>
    </Modal>
  );
}
