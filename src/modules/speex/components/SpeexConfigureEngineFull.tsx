import * as React from 'react';

import { Box, Button, Divider, FormControl, FormHelperText, Input, Typography } from '@mui/joy';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import { FormChipControl } from '~/common/components/forms/FormChipControl';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSliderControl } from '~/common/components/forms/FormSliderControl';
import { FormTextField } from '~/common/components/forms/FormTextField';

import type { DCredentialsApiKey, DSpeexEngine, DSpeexEngineAny, DVoiceElevenLabs, DVoiceLocalAI, DVoiceOpenAI, DVoiceWebSpeech } from '../speex.types';
import { SPEEX_DEFAULTS, SPEEX_PREVIEW_TEXT } from '../speex.config';
import { SpeexVoiceSelect } from './SpeexVoiceSelect';
import { speakText } from '../speex.client';


// Credential input helper - shared across vendors
function CredentialsApiKeyInputs({ credentials, onUpdate, showHost, hostRequired, hostPlaceholder }: {
  credentials: DCredentialsApiKey;
  onUpdate: (credentials: DCredentialsApiKey) => void;
  showHost?: boolean;
  hostRequired?: boolean;
  hostPlaceholder?: string;
}) {
  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='API Key' description={hostRequired ? 'Optional' : 'Required'} />
      <Input
        type='password'
        value={credentials.apiKey}
        onChange={(e) => onUpdate({ ...credentials, apiKey: e.target.value })}
        placeholder='sk-...'
        sx={{ minWidth: 200 }}
      />
    </FormControl>

    {showHost && (
      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title='API Host' description={hostRequired ? 'Required' : 'Optional'} />
        <Input
          value={credentials.apiHost ?? ''}
          onChange={(e) => onUpdate({ ...credentials, apiHost: e.target.value || undefined })}
          placeholder={hostPlaceholder ?? 'https://api.example.com'}
          sx={{ minWidth: 200 }}
        />
      </FormControl>
    )}

  </>;
}


function PreviewButton({ engineId }: { engineId: DSpeexEngineAny['engineId'] }) {

  // state
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  const handlePreview = React.useCallback(async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    await speakText(
      SPEEX_PREVIEW_TEXT,
      { engineId: engineId },
      { streaming: true, playback: true },
      { onComplete: () => setIsSpeaking(false), onError: () => setIsSpeaking(false) },
    );
  }, [engineId, isSpeaking]);

  return (
    <Button
      variant='outlined'
      color='neutral'
      size='sm'
      onClick={handlePreview}
      disabled={isSpeaking}
      startDecorator={isSpeaking ? <StopRoundedIcon /> : <PlayArrowRoundedIcon />}
      sx={{ ml: 'auto' }}
    >
      {isSpeaking ? 'Speaking...' : 'Preview'}
    </Button>
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
    <Divider sx={{ my: 1 }} inset='context' />

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

function ElevenLabsConfig({ engine, onUpdate, mode }: {
  engine: DSpeexEngine<'elevenlabs'>,
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
  isMobile: boolean;
  mode: 'full' | 'voice-only';
}) {

  const { credentials, voice } = engine;
  const showCredentials = mode === 'full' && !engine.isAutoLinked && credentials.type === 'api-key';

  const handleCredentialsUpdate = React.useCallback((newCredentials: DCredentialsApiKey) => {
    onUpdate({ credentials: newCredentials });
  }, [onUpdate]);

  const handleVoiceChange = React.useCallback((ttsVoiceId: DVoiceElevenLabs['ttsVoiceId']) => {
    onUpdate({ voice: { ...voice, ttsVoiceId } });
  }, [onUpdate, voice]);

  return <>
    {/* Credentials (only for manually added engines in full mode) */}
    {showCredentials && (
      <CredentialsApiKeyInputs
        credentials={credentials}
        onUpdate={handleCredentialsUpdate}
      />
    )}

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden' }}>
      <FormLabelStart title='Voice' description='ElevenLabs voice' />
      <SpeexVoiceSelect
        engine={engine}
        voiceId={voice.ttsVoiceId ?? null}
        onVoiceChange={handleVoiceChange}
        autoPreview
      />
    </FormControl>

    <FormChipControl<Exclude<DVoiceElevenLabs['ttsModel'], undefined>>
      title='Model'
      alignEnd
      options={[
        { value: 'eleven_multilingual_v2', label: 'Multilingual v2', description: 'Recommended' },
        { value: 'eleven_turbo_v2_5', label: 'Turbo v2.5', description: 'Fast' },
        { value: 'eleven_flash_v2_5', label: 'Flash v2.5', description: 'Fastest' },
        { value: 'eleven_v3', label: 'v3', description: 'Newest' },
      ]}
      value={voice.ttsModel ?? SPEEX_DEFAULTS.ELEVENLABS_MODEL}
      onChange={(value) => onUpdate({ voice: { ...voice, ttsModel: value } })}
    />

    {showCredentials && (
      <FormHelperText>
        Voice listing requires API key. Language auto-detected from preferences.
      </FormHelperText>
    )}
  </>;
}


function LocalAIConfig({ engine, onUpdate, mode }: {
  engine: DSpeexEngine<'localai'>,
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
  isMobile: boolean;
  mode: 'full' | 'voice-only';
}) {
  const { credentials, voice } = engine;
  const showCredentials = mode === 'full' && !engine.isAutoLinked && credentials.type === 'api-key';

  const handleCredentialsUpdate = React.useCallback((newCredentials: DCredentialsApiKey) => {
    onUpdate({ credentials: newCredentials });
  }, [onUpdate]);

  const handleModelChange = React.useCallback((ttsModel: DVoiceLocalAI['ttsModel']) => {
    onUpdate({ voice: { ...voice, ttsModel } });
  }, [onUpdate, voice]);

  return <>

    {/* Credentials (only for manually added engines in full mode) */}
    {showCredentials && (
      <CredentialsApiKeyInputs
        credentials={credentials}
        onUpdate={handleCredentialsUpdate}
        showHost
        hostRequired
        hostPlaceholder='http://localhost:8080'
      />
    )}

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden' }}>
      <FormLabelStart title='Model' description='TTS model' />
      <SpeexVoiceSelect
        engine={engine}
        voiceId={voice.ttsModel ?? null}
        onVoiceChange={handleModelChange}
      />
    </FormControl>

    <FormControl>
      <FormLabelStart title='Model Override' description='Manual model name' />
      <Input
        value={voice.ttsModel ?? ''}
        onChange={(e) => onUpdate({ voice: { ...voice, ttsModel: e.target.value } })}
        placeholder='e.g., kokoro'
      />
      <FormHelperText>Override if model not in dropdown</FormHelperText>
    </FormControl>

    <FormControl>
      <FormLabelStart title='Backend' description='TTS backend (optional)' />
      <Input
        value={voice.ttsBackend ?? ''}
        onChange={(e) => onUpdate({ voice: { ...voice, ttsBackend: e.target.value || undefined } })}
        placeholder='e.g., coqui, bark, piper'
      />
      <FormHelperText>Leave empty for default backend</FormHelperText>
    </FormControl>

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
    onUpdate({ voice: { ...voice, ttsVoiceId } });
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
      onChange={(value) => onUpdate({ voice: { ...voice, ttsModel: value as DVoiceOpenAI['ttsModel'] } })}
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
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
  isMobile: boolean;
  mode: 'full' | 'voice-only';
}) {

  const { voice } = engine;

  const handleVoiceChange = React.useCallback((ttsVoiceURI: DVoiceWebSpeech['ttsVoiceURI']) => {
    onUpdate({ voice: { ...voice, ttsVoiceURI } });
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
