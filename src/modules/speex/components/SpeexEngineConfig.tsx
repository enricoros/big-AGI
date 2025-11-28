/**
 * SpeexEngineConfig - Vendor-specific engine configuration
 *
 * Dynamically renders configuration UI based on engine vendor type.
 * Supports both full mode (credentials + voice) and voice-only mode.
 *
 * Used in:
 * - VoiceSettings (global engine configuration)
 * - PersonaEditor (per-persona voice override)
 */

import * as React from 'react';

import { Box, Button, FormControl, FormHelperText, Input, Slider, Typography } from '@mui/joy';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import { FormChipControl } from '~/common/components/forms/FormChipControl';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';

import type { DCredentialsApiKey, DSpeexEngine, DSpeexEngineAny, DVoiceElevenLabs, DVoiceLocalAI, DVoiceOpenAI, DVoiceWebSpeech } from '../speex.types';
import { speakText } from '../speex.client';
import { SpeexVoiceSelect } from './SpeexVoiceSelect';


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


// configuration
const PREVIEW_TEXT = 'Hello, this is my voice.';


function PreviewButton({ engine }: { engine: DSpeexEngineAny }) {
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  const handlePreview = async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    await speakText(
      PREVIEW_TEXT,
      { engineId: engine.engineId },
      { streaming: true, playback: true },
      { onComplete: () => setIsSpeaking(false), onError: () => setIsSpeaking(false) },
    );
  };

  return (
    <Button
      variant='outlined'
      color='neutral'
      size='sm'
      onClick={handlePreview}
      disabled={isSpeaking}
      startDecorator={isSpeaking ? <StopRoundedIcon /> : <PlayArrowRoundedIcon />}
    >
      {isSpeaking ? 'Speaking...' : 'Preview'}
    </Button>
  );
}


export function SpeexEngineConfig(props: {
  engine: DSpeexEngineAny;
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
  mode?: 'full' | 'voice-only'; // full: credentials + voice, voice-only: just voice settings
}) {
  const { engine, onUpdate, mode = 'full' } = props;
  switch (engine.vendorType) {
    case 'elevenlabs':
      return <ElevenLabsConfig engine={engine} onUpdate={onUpdate} mode={mode} />;
    case 'localai':
      return <LocalAIConfig engine={engine} onUpdate={onUpdate} mode={mode} />;
    case 'openai':
      return <OpenAIConfig engine={engine} onUpdate={onUpdate} mode={mode} />;
    case 'webspeech':
      return <WebSpeechConfig engine={engine} onUpdate={onUpdate} mode={mode} />;
    default:
      return <Typography level='body-sm' color='warning'>Unknown engine type</Typography>;
  }
}


// Vendor-specific configs

function ElevenLabsConfig({ engine, onUpdate, mode }: {
  engine: DSpeexEngine<'elevenlabs'>,
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
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

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Voice' description='ElevenLabs voice' />
      <SpeexVoiceSelect
        engine={engine}
        voiceId={voice.ttsVoiceId ?? null}
        onVoiceChange={handleVoiceChange}
        autoPreview
      />
    </FormControl>

    <FormChipControl
      title='Model'
      description={voice.ttsModel === 'eleven_flash_v2_5' ? 'Fastest'
        : voice.ttsModel === 'eleven_turbo_v2_5' ? 'Fast, English'
          : voice.ttsModel === 'eleven_v3' ? 'Newest'
            : 'Recommended'}
      options={[
        { value: 'eleven_multilingual_v2', label: 'Multilingual v2' },
        { value: 'eleven_turbo_v2_5', label: 'Turbo v2.5' },
        { value: 'eleven_flash_v2_5', label: 'Flash v2.5' },
        { value: 'eleven_v3', label: 'v3' },
      ]}
      value={voice.ttsModel ?? 'eleven_multilingual_v2'}
      onChange={(value) => onUpdate({ voice: { ...voice, ttsModel: value as DVoiceElevenLabs['ttsModel'] } })}
    />

    {showCredentials && (
      <FormHelperText>
        Voice listing requires API key. Language auto-detected from preferences.
      </FormHelperText>
    )}

    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
      <PreviewButton engine={engine} />
    </Box>
  </>;
}


function LocalAIConfig({ engine, onUpdate, mode }: {
  engine: DSpeexEngine<'localai'>,
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
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

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
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

    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
      <PreviewButton engine={engine} />
    </Box>
  </>;
}


function OpenAIConfig({ engine, onUpdate, mode }: {
  engine: DSpeexEngine<'openai'>,
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
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

  const handleSpeedChange = React.useCallback((_: unknown, value: number | number[]) => {
    onUpdate({ voice: { ...voice, ttsSpeed: value as number } });
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

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Voice' description='OpenAI TTS voice' />
      <SpeexVoiceSelect
        engine={engine}
        voiceId={voice.ttsVoiceId ?? null}
        onVoiceChange={handleVoiceChange}
      />
    </FormControl>

    <FormChipControl
      title='Model'
      description={voice.ttsModel === 'tts-1-hd' ? 'Higher quality'
        : voice.ttsModel === 'gpt-4o-mini-tts' ? 'Expressive'
          : 'Fast'}
      options={[
        { value: 'tts-1', label: 'TTS-1' },
        { value: 'tts-1-hd', label: 'TTS-1-HD' },
        { value: 'gpt-4o-mini-tts', label: 'GPT-4o Mini' },
      ]}
      value={voice.ttsModel ?? 'tts-1'}
      onChange={(value) => onUpdate({ voice: { ...voice, ttsModel: value as DVoiceOpenAI['ttsModel'] } })}
    />

    <FormControl>
      <FormLabelStart title='Speed' description={`${(voice.ttsSpeed ?? 1).toFixed(2)}x`} />
      <Slider
        value={voice.ttsSpeed ?? 1}
        onChange={handleSpeedChange}
        min={0.5}
        max={2}
        step={0.25}
        valueLabelDisplay='auto'
      />
    </FormControl>

    {voice.ttsModel === 'gpt-4o-mini-tts' && (
      <FormControl>
        <FormLabelStart title='Voice Instruction' description='Custom voice guidance' />
        <Input
          value={voice.ttsInstruction ?? ''}
          onChange={(e) => onUpdate({ voice: { ...voice, ttsInstruction: e.target.value } })}
          placeholder='e.g., Speak with enthusiasm'
        />
        <FormHelperText>Only for GPT-4o Mini TTS model</FormHelperText>
      </FormControl>
    )}

    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
      <PreviewButton engine={engine} />
    </Box>
  </>;
}


function WebSpeechConfig({ engine, onUpdate, mode }: {
  engine: DSpeexEngine<'webspeech'>
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
  mode: 'full' | 'voice-only';
}) {

  const { voice } = engine;

  const handleVoiceChange = React.useCallback((ttsVoiceURI: DVoiceWebSpeech['ttsVoiceURI']) => {
    onUpdate({ voice: { ...voice, ttsVoiceURI } });
  }, [onUpdate, voice]);

  const handleSpeedChange = React.useCallback((_: unknown, value: number | number[]) => {
    onUpdate({ voice: { ...voice, ttsSpeed: value as number } });
  }, [onUpdate, voice]);

  const handlePitchChange = React.useCallback((_: unknown, value: number | number[]) => {
    onUpdate({ voice: { ...voice, ttsPitch: value as number } });
  }, [onUpdate, voice]);

  return <>
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Voice' description='System voice' />
      <SpeexVoiceSelect
        engine={engine}
        voiceId={voice.ttsVoiceURI ?? null}
        onVoiceChange={handleVoiceChange}
      />
    </FormControl>

    <FormControl>
      <FormLabelStart title='Speed' description={`${(voice.ttsSpeed ?? 1).toFixed(1)}x`} />
      <Slider
        value={voice.ttsSpeed ?? 1}
        onChange={handleSpeedChange}
        min={0.5}
        max={2}
        step={0.1}
        valueLabelDisplay='auto'
      />
    </FormControl>

    <FormControl>
      <FormLabelStart title='Pitch' description={`${(voice.ttsPitch ?? 1).toFixed(1)}`} />
      <Slider
        value={voice.ttsPitch ?? 1}
        onChange={handlePitchChange}
        min={0.5}
        max={2}
        step={0.1}
        valueLabelDisplay='auto'
      />
    </FormControl>

    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
      <PreviewButton engine={engine} />
    </Box>
  </>;
}
