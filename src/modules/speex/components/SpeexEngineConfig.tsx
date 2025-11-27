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

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';

import type { DSpeexEngine, DSpeexEngineAny, DVoiceElevenLabs, DVoiceLocalAI, DVoiceOpenAI, DVoiceWebSpeech } from '../speex.types';
import { speakText } from '../speex.client';
import { SpeexVoiceDropdown } from './SpeexVoiceDropdown';


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

  const { voice } = engine;

  const handleVoiceChange = React.useCallback((ttsVoiceId: DVoiceElevenLabs['ttsVoiceId']) => {
    onUpdate({ voice: { ...voice, ttsVoiceId } });
  }, [onUpdate, voice]);

  return <>
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Voice' description='ElevenLabs voice' />
      <SpeexVoiceDropdown
        engine={engine}
        voiceId={voice.ttsVoiceId ?? null}
        onVoiceChange={handleVoiceChange}
      />
    </FormControl>

    <FormControl>
      <FormLabelStart title='Model' description='TTS model' />
      <select
        value={voice.ttsModel ?? 'eleven_multilingual_v2'}
        onChange={(e) => onUpdate({ voice: { ...voice, ttsModel: e.target.value as DVoiceElevenLabs['ttsModel'] } })}
        style={{ padding: '8px', borderRadius: '4px' }}
      >
        <option value='eleven_multilingual_v2'>Multilingual v2 (recommended)</option>
        <option value='eleven_turbo_v2_5'>Turbo v2.5 (fast, English)</option>
        <option value='eleven_flash_v2_5'>Flash v2.5 (fastest)</option>
        <option value='eleven_v3'>v3 (newest)</option>
      </select>
      <FormHelperText>
        Multilingual v2 works best for non-English or mixed content. Turbo v2.5 is faster for English-only.
      </FormHelperText>
    </FormControl>

    <FormHelperText>
      Voice listing requires API key. Language auto-detected from preferences.
    </FormHelperText>

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
  const { voice } = engine;

  const handleModelChange = React.useCallback((ttsModel: DVoiceLocalAI['ttsModel']) => {
    onUpdate({ voice: { ...voice, ttsModel } });
  }, [onUpdate, voice]);

  return <>
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Model' description='TTS model' />
      <SpeexVoiceDropdown
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

  const { voice } = engine;

  const handleVoiceChange = React.useCallback((ttsVoiceId: DVoiceOpenAI['ttsVoiceId']) => {
    onUpdate({ voice: { ...voice, ttsVoiceId } });
  }, [onUpdate, voice]);

  const handleSpeedChange = React.useCallback((_: unknown, value: number | number[]) => {
    onUpdate({ voice: { ...voice, ttsSpeed: value as number } });
  }, [onUpdate, voice]);

  return <>
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Voice' description='OpenAI TTS voice' />
      <SpeexVoiceDropdown
        engine={engine}
        voiceId={voice.ttsVoiceId ?? null}
        onVoiceChange={handleVoiceChange}
      />
    </FormControl>

    <FormControl>
      <FormLabelStart title='Model' description='TTS model quality' />
      <select
        value={voice.ttsModel ?? 'tts-1'}
        onChange={(e) => onUpdate({ voice: { ...voice, ttsModel: e.target.value as DVoiceOpenAI['ttsModel'] } })}
        style={{ padding: '8px', borderRadius: '4px' }}
      >
        <option value='tts-1'>TTS-1 (fast)</option>
        <option value='tts-1-hd'>TTS-1-HD (quality)</option>
        <option value='gpt-4o-mini-tts'>GPT-4o Mini TTS (expressive)</option>
      </select>
    </FormControl>

    <FormControl>
      <FormLabelStart title='Speed' />
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
      <SpeexVoiceDropdown
        engine={engine}
        voiceId={voice.ttsVoiceURI ?? null}
        onVoiceChange={handleVoiceChange}
      />
    </FormControl>

    <FormControl>
      <FormLabelStart title='Speed' />
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
      <FormLabelStart title='Pitch' />
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
