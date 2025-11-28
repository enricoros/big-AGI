import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Box, Button, Divider, FormControl, Typography } from '@mui/joy';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import { FormChipControl } from '~/common/components/forms/FormChipControl';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSecretField } from '~/common/components/forms/FormSecretField';
import { FormSliderControl } from '~/common/components/forms/FormSliderControl';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';

import type { DCredentialsApiKey, DSpeexEngine, DSpeexEngineAny, DSpeexVendorType, DVoiceElevenLabs, DVoiceLocalAI, DVoiceOpenAI, DVoiceWebSpeech } from '../speex.types';
import { SPEEX_DEFAULTS, SPEEX_PREVIEW_STREAM, SPEEX_PREVIEW_TEXT } from '../speex.config';
import { SpeexVoiceAutocomplete } from './SpeexVoiceAutocomplete';
import { SpeexVoiceSelect } from './SpeexVoiceSelect';
import { speakText } from '../speex.client';
import { speexVendorTypeLabel } from './SpeexEngineSelect';


function CredentialsApiKeyInputs({ credentials, onUpdate, vendorType, showHost, hostRequired, hostPlaceholder }: {
  credentials: DCredentialsApiKey;
  onUpdate: (credentials: DCredentialsApiKey) => void;
  vendorType: DSpeexVendorType;
  showHost?: boolean;
  hostRequired?: boolean;
  hostPlaceholder?: string;
}) {
  return <>

    <FormSecretField
      autoCompleteId={`speex-${vendorType}-key`}
      title='API Key'
      description={hostRequired ? 'Optional' : speexVendorTypeLabel(vendorType)}
      value={credentials.apiKey}
      onChange={value => onUpdate({ ...credentials, apiKey: value })}
      required={!hostRequired}
      startDecorator={credentials.apiKey ? false : undefined}
      // placeholder='Required'
      inputSx={{ maxWidth: 220 }}
    />

    {showHost && (
      <FormTextField
        autoCompleteId={`speex-${vendorType}-host`}
        title='API Host'
        description={hostRequired ? 'Required' : 'Optional'}
        value={credentials.apiHost ?? ''}
        onChange={text => onUpdate({ ...credentials, apiHost: text || undefined })}
        placeholder={hostPlaceholder ?? 'https://api.example.com'}
        inputSx={{ maxWidth: 220 }}
      />
    )}

    {showHost && <Divider inset='context' />}

  </>;
}


function PreviewButton({ engineId }: { engineId: DSpeexEngineAny['engineId'] }) {

  // async + cache
  const { isFetching, isError, error, refetch: previewVoice } = useQuery({
    enabled: false, // manual trigger only
    queryKey: ['speex-preview', engineId],
    queryFn: async () => {
      const result = await speakText(
        SPEEX_PREVIEW_TEXT,
        { engineId: engineId },
        { streaming: SPEEX_PREVIEW_STREAM },
      );
      if (!result.success) throw new Error(result.error || 'Preview failed');
      return result;
    },
  });

  return (
    <TooltipOutlined color='danger' title={error?.message ? <pre>{error.message}</pre> : false}>
      <Button
        variant='outlined'
        color={isError ? 'danger' : 'neutral'}
        size='sm'
        onClick={() => previewVoice()}
        disabled={isFetching}
        startDecorator={isFetching ? <StopRoundedIcon /> : <PlayArrowRoundedIcon />}
        sx={{ ml: 'auto', minWidth: 130 }}
      >
        {isFetching ? 'Speaking...' : isError ? 'Retry' : 'Preview'}
      </Button>
    </TooltipOutlined>
  );
}


export function SpeexConfigureEngineFull(props: {
  engine: DSpeexEngineAny;
  isMobile: boolean;
  mode?: 'full' | 'voice-only';
  bottomStart?: React.ReactNode;
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
}) {
  const { engine, isMobile, mode = 'full', bottomStart, onUpdate } = props;
  return <>

    {/*<Box mt={2} />*/}
    {/*<Divider sx={{ my: 1 }} inset='context' />*/}
    <Divider sx={{ my: 1 }} inset='context'>{isMobile ? 'Configuration' : 'App Voice Configuration'}</Divider>

    {/* Engine-Specific pane */}
    {engine.vendorType === 'elevenlabs' ? (
      <ElevenLabsConfig engine={engine} onUpdate={onUpdate} isMobile={isMobile} mode={mode} />
    ) : engine.vendorType === 'localai' ? (
      <LocalAIConfig engine={engine} onUpdate={onUpdate} isMobile={isMobile} mode={mode} />
    ) : engine.vendorType === 'openai' ? (
      <OpenAIConfig engine={engine} onUpdate={onUpdate} isMobile={isMobile} mode={mode} />
    ) : engine.vendorType === 'webspeech' ? (
      <WebSpeechConfig engine={engine} onUpdate={onUpdate} isMobile={isMobile} mode={mode} />
    ) : (
      <Typography level='body-sm' color='warning'>Unknown engine type {(engine as any)?.vendorType}</Typography>
    )}

    {/* (Delete | Chip) -- Preview */}
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      {bottomStart}
      <PreviewButton engineId={engine.engineId} />
    </Box>

  </>;
}


// Vendor-specific configs

function ElevenLabsConfig({ engine, onUpdate, mode, isMobile }: {
  engine: DSpeexEngine<'elevenlabs'>,
  onUpdate: (updates: Partial<DSpeexEngine<'elevenlabs'>>) => void;
  isMobile: boolean;
  mode: 'full' | 'voice-only';
}) {

  const { credentials, voice } = engine;
  const showCredentials = mode === 'full' && !engine.isAutoLinked && credentials.type === 'api-key';

  const handleCredentialsUpdate = React.useCallback((newCredentials: DCredentialsApiKey) => {
    onUpdate({ credentials: newCredentials });
  }, [onUpdate]);

  const handleVoiceChange = React.useCallback((ttsVoiceId: DVoiceElevenLabs['ttsVoiceId']) => {
    const { ttsVoiceId: _, ...restVoice } = voice;
    onUpdate({
      voice: {
        ...restVoice,
        ...(ttsVoiceId && { ttsVoiceId }),
      },
    });
  }, [onUpdate, voice]);

  return <>

    {/* Credentials (only for manually added engines in full mode) */}
    {showCredentials && (
      <CredentialsApiKeyInputs
        credentials={credentials}
        onUpdate={handleCredentialsUpdate}
        vendorType='elevenlabs'
      />
    )}

    <FormChipControl<Exclude<DVoiceElevenLabs['ttsModel'], undefined>>
      title='Model'
      alignEnd
      options={[
        { value: 'eleven_multilingual_v2', label: 'Multilingual v2', description: 'Default' },
        { value: 'eleven_turbo_v2_5', label: 'Turbo v2.5', description: 'Fast' },
        { value: 'eleven_flash_v2_5', label: 'Flash v2.5', description: 'Fastest' },
        { value: 'eleven_v3', label: 'v3', description: 'Newest' },
      ]}
      value={voice.ttsModel ?? SPEEX_DEFAULTS.ELEVENLABS_MODEL}
      onChange={(value) => onUpdate({ voice: { ...voice, ttsModel: value } })}
    />

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden' }}>
      <FormLabelStart title='Voice' description={isMobile ? undefined : 'ElevenLabs voice'} />
      <SpeexVoiceSelect
        autoPreview
        engine={engine}
        voiceId={voice.ttsVoiceId ?? null}
        onVoiceChange={handleVoiceChange}
      />
    </FormControl>

    {/*{showCredentials && (*/}
    {/*  <FormHelperText>*/}
    {/*    Voice listing requires API key. Language auto-detected from preferences.*/}
    {/*  </FormHelperText>*/}
    {/*)}*/}

  </>;
}


function LocalAIConfig({ engine, onUpdate, mode, isMobile }: {
  engine: DSpeexEngine<'localai'>,
  onUpdate: (updates: Partial<DSpeexEngine<'localai'>>) => void;
  isMobile: boolean;
  mode: 'full' | 'voice-only';
}) {
  const { credentials, voice } = engine;
  const showCredentials = mode === 'full' && !engine.isAutoLinked && credentials.type === 'api-key';

  const handleCredentialsUpdate = React.useCallback((newCredentials: DCredentialsApiKey) => {
    onUpdate({ credentials: newCredentials });
  }, [onUpdate]);

  const handleModelChange = React.useCallback((ttsModel: DVoiceLocalAI['ttsModel']) => {
    const { ttsModel: _, ...restVoice } = voice;
    onUpdate({
      voice: {
        ...restVoice,
        ...(ttsModel && { ttsModel }),
      },
    });
  }, [onUpdate, voice]);

  return <>

    {/* Credentials (only for manually added engines in full mode) */}
    {showCredentials && (
      <CredentialsApiKeyInputs
        credentials={credentials}
        onUpdate={handleCredentialsUpdate}
        vendorType='localai'
        showHost
        hostRequired
        hostPlaceholder='http://localhost:8080'
      />
    )}

    {/* Model: autocomplete with suggestions + free-form input */}
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden' }}>
      <FormLabelStart title='Model' description={isMobile ? undefined : 'Select or type'} />
      <SpeexVoiceAutocomplete
        engine={engine}
        value={voice.ttsModel}
        onValueChange={handleModelChange}
        placeholder='e.g., kokoro'
      />
    </FormControl>

    <FormTextField
      autoCompleteId='speex-localai-backend'
      title='Backend'
      description='Optional'
      placeholder='e.g., coqui, bark, piper'
      value={voice.ttsBackend ?? ''}
      onChange={(text) => onUpdate({ voice: { ...voice, ttsBackend: text || undefined } })}
      inputSx={{ maxWidth: 220 }}
    />

  </>;
}


function OpenAIConfig({ engine, onUpdate, isMobile, mode }: {
  engine: DSpeexEngine<'openai'>,
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
  isMobile: boolean;
  mode: 'full' | 'voice-only';
}) {

  const { credentials, voice } = engine;
  const showCredentials = mode === 'full' && !engine.isAutoLinked && credentials.type === 'api-key';

  const handleCredentialsUpdate = React.useCallback((newCredentials: DCredentialsApiKey) => {
    onUpdate({ credentials: newCredentials });
  }, [onUpdate]);

  const handleVoiceChange = React.useCallback((ttsVoiceId: DVoiceOpenAI['ttsVoiceId']) => {
    const { ttsVoiceId: _, ...restVoice } = voice;
    onUpdate({
      voice: {
        ...restVoice,
        ...(ttsVoiceId && { ttsVoiceId }),
      },
    });
  }, [onUpdate, voice]);

  const handleSpeedChange = React.useCallback((value: number) => {
    onUpdate({ voice: { ...voice, ttsSpeed: value } });
  }, [onUpdate, voice]);

  return <>

    {/* Credentials (only for manually added engines in full mode) */}
    {showCredentials && (
      <CredentialsApiKeyInputs
        credentials={credentials}
        onUpdate={handleCredentialsUpdate}
        vendorType='openai'
        showHost
        hostPlaceholder='https://api.openai.com (optional)'
      />
    )}

    <FormChipControl<DVoiceOpenAI['ttsModel']>
      title='Model'
      alignEnd
      options={[
        { value: 'gpt-4o-mini-tts', label: 'GPT-4o Mini', description: 'Expressive' },
        { value: 'tts-1', label: 'TTS-1', description: 'Fast' },
        { value: 'tts-1-hd', label: 'TTS-1-HD', description: 'Quality' },
      ]}
      value={voice.ttsModel ?? SPEEX_DEFAULTS.OPENAI_MODEL}
      onChange={value => onUpdate({
        voice: {
          ...voice,
          ttsModel: value,
        },
      })}
    />

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden' }}>
      <FormLabelStart title='Voice' description={isMobile ? undefined : 'OpenAI TTS voice'} />
      <SpeexVoiceSelect
        engine={engine}
        voiceId={voice.ttsVoiceId ?? null}
        onVoiceChange={handleVoiceChange}
      />
    </FormControl>


    <FormSliderControl
      title='Speed'
      description={`${voice.ttsSpeed ?? 1}x`}
      min={0.5}
      max={2}
      step={0.25}
      value={voice.ttsSpeed ?? 1}
      onChange={handleSpeedChange}
      valueLabelDisplay={voice.ttsSpeed && voice.ttsSpeed !== 1 ? 'on' : 'auto'}
      sliderSx={{ maxWidth: 220, my: -0.5 }}
    />

    {voice.ttsModel === 'gpt-4o-mini-tts' && (
      <FormTextField
        autoCompleteId='speex-openai-instruction'
        title='Instruction'
        description={isMobile ? undefined : '4o Mini only'}
        placeholder='e.g., Speak with joy'
        value={voice.ttsInstruction ?? ''}
        onChange={(text) => onUpdate({ voice: { ...voice, ttsInstruction: text } })}
        inputSx={{ flexGrow: 1, maxWidth: 220 }}
      />
    )}

  </>;
}


function WebSpeechConfig({ engine, onUpdate, isMobile }: {
  engine: DSpeexEngine<'webspeech'>
  onUpdate: (updates: Partial<DSpeexEngine<'webspeech'>>) => void;
  isMobile: boolean;
  mode: 'full' | 'voice-only';
}) {

  const { voice } = engine;

  const handleVoiceChange = React.useCallback((ttsVoiceURI: DVoiceWebSpeech['ttsVoiceURI']) => {
    const { ttsVoiceURI: _, ...restVoice } = voice;
    onUpdate({
      voice: {
        ...restVoice,
        ...(ttsVoiceURI && { ttsVoiceURI }),
      },
    });
  }, [onUpdate, voice]);

  const handleSpeedChange = React.useCallback((value: number) => {
    onUpdate({ voice: { ...voice, ttsSpeed: value } });
  }, [onUpdate, voice]);

  const handlePitchChange = React.useCallback((value: number) => {
    onUpdate({ voice: { ...voice, ttsPitch: value } });
  }, [onUpdate, voice]);

  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden' }}>
      <FormLabelStart title='Voice' description={isMobile ? undefined : 'System voice'} />
      <SpeexVoiceSelect
        engine={engine}
        voiceId={voice.ttsVoiceURI ?? null}
        onVoiceChange={handleVoiceChange}
      />
    </FormControl>

    <FormSliderControl
      title='Speed'
      description={`${(voice.ttsSpeed ?? 1).toFixed(1)}x`}
      min={0.5}
      max={2}
      step={0.1}
      value={voice.ttsSpeed ?? 1}
      onChange={handleSpeedChange}
      valueLabelDisplay={voice.ttsSpeed && voice.ttsSpeed !== 1 ? 'on' : 'auto'}
      sliderSx={{ maxWidth: 220, my: -0.5 }}
    />

    <FormSliderControl
      title='Pitch'
      description={`${(voice.ttsPitch ?? 1).toFixed(1)}`}
      min={0.5}
      max={2}
      step={0.1}
      value={voice.ttsPitch ?? 1}
      onChange={handlePitchChange}
      valueLabelDisplay={voice.ttsPitch && voice.ttsPitch !== 1 ? 'on' : 'auto'}
      sliderSx={{ maxWidth: 220, my: -0.5 }}
    />

  </>;
}
