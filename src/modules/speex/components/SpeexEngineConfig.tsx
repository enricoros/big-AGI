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

import { FormControl, FormHelperText, Input, Slider, Typography } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';

import type { DSpeexEngineAny, DVoiceElevenLabs, DVoiceLocalAI, DVoiceOpenAI, DVoiceWebSpeech, SpeexVendorType } from '../speex.types';
import { SpeexVoiceDropdown } from './SpeexVoiceDropdown';


interface SpeexEngineConfigProps {
  engine: DSpeexEngineAny;
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
  mode?: 'full' | 'voice-only'; // full: credentials + voice, voice-only: just voice settings
}


export function SpeexEngineConfig(props: SpeexEngineConfigProps) {
  const { engine, onUpdate, mode = 'full' } = props;

  // Route to vendor-specific config
  switch (engine.vendorType) {
    case 'webspeech':
      return <WebSpeechConfig engine={engine} onUpdate={onUpdate} mode={mode} />;
    case 'openai':
      return <OpenAIConfig engine={engine} onUpdate={onUpdate} mode={mode} />;
    case 'elevenlabs':
      return <ElevenLabsConfig engine={engine} onUpdate={onUpdate} mode={mode} />;
    case 'localai':
      return <LocalAIConfig engine={engine} onUpdate={onUpdate} mode={mode} />;
    default:
      return <Typography level='body-sm' color='warning'>Unknown engine type</Typography>;
  }
}


// Vendor-specific configs

function WebSpeechConfig({ engine, onUpdate, mode }: {
  engine: DSpeexEngineAny & { vendorType: 'webspeech' };
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
  mode: 'full' | 'voice-only';
}) {
  const voice = engine.voice as DVoiceWebSpeech;

  const handleVoiceChange = (voiceURI: string) => {
    onUpdate({
      voice: { ...voice, ttsVoiceURI: voiceURI },
    });
  };

  const handleRateChange = (_: unknown, value: number | number[]) => {
    onUpdate({
      voice: { ...voice, rate: value as number },
    });
  };

  const handlePitchChange = (_: unknown, value: number | number[]) => {
    onUpdate({
      voice: { ...voice, pitch: value as number },
    });
  };

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
        value={voice.rate ?? 1}
        onChange={handleRateChange}
        min={0.5}
        max={2}
        step={0.1}
        valueLabelDisplay='auto'
      />
    </FormControl>

    <FormControl>
      <FormLabelStart title='Pitch' />
      <Slider
        value={voice.pitch ?? 1}
        onChange={handlePitchChange}
        min={0.5}
        max={2}
        step={0.1}
        valueLabelDisplay='auto'
      />
    </FormControl>
  </>;
}


function OpenAIConfig({ engine, onUpdate, mode }: {
  engine: DSpeexEngineAny & { vendorType: 'openai' };
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
  mode: 'full' | 'voice-only';
}) {
  const voice = engine.voice as DVoiceOpenAI;

  const handleVoiceChange = (voiceId: string) => {
    onUpdate({
      voice: { ...voice, voiceId },
    });
  };

  const handleSpeedChange = (_: unknown, value: number | number[]) => {
    onUpdate({
      voice: { ...voice, speed: value as number },
    });
  };

  return <>
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Voice' description='OpenAI TTS voice' />
      <SpeexVoiceDropdown
        engine={engine}
        voiceId={voice.voiceId ?? null}
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
        value={voice.speed ?? 1}
        onChange={handleSpeedChange}
        min={0.25}
        max={4}
        step={0.25}
        valueLabelDisplay='auto'
      />
    </FormControl>

    {voice.ttsModel === 'gpt-4o-mini-tts' && (
      <FormControl>
        <FormLabelStart title='Voice Instruction' description='Custom voice guidance' />
        <Input
          value={voice.instruction ?? ''}
          onChange={(e) => onUpdate({ voice: { ...voice, instruction: e.target.value } })}
          placeholder='e.g., Speak with enthusiasm'
        />
        <FormHelperText>Only for GPT-4o Mini TTS model</FormHelperText>
      </FormControl>
    )}
  </>;
}


function ElevenLabsConfig({ engine, onUpdate, mode }: {
  engine: DSpeexEngineAny & { vendorType: 'elevenlabs' };
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
  mode: 'full' | 'voice-only';
}) {
  const voice = engine.voice as DVoiceElevenLabs;

  const handleVoiceChange = (voiceId: string) => {
    onUpdate({
      voice: { ...voice, voiceId },
    });
  };

  return <>
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Voice' description='ElevenLabs voice' />
      <SpeexVoiceDropdown
        engine={engine}
        voiceId={voice.voiceId ?? null}
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
        <option value='eleven_multilingual_v2'>Multilingual v2</option>
        <option value='eleven_turbo_v2_5'>Turbo v2.5</option>
        <option value='eleven_flash_v2_5'>Flash v2.5</option>
        <option value='eleven_v3'>v3</option>
      </select>
    </FormControl>

    <FormHelperText>
      Voice listing for ElevenLabs requires API key configuration.
    </FormHelperText>
  </>;
}


function LocalAIConfig({ engine, onUpdate, mode }: {
  engine: DSpeexEngineAny & { vendorType: 'localai' };
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
  mode: 'full' | 'voice-only';
}) {
  const voice = engine.voice as DVoiceLocalAI;

  return <>
    <FormControl>
      <FormLabelStart title='Model' description='TTS model name' />
      <Input
        value={voice.ttsModel ?? ''}
        onChange={(e) => onUpdate({ voice: { ...voice, ttsModel: e.target.value } })}
        placeholder='e.g., kokoro'
      />
      <FormHelperText>Model to use for speech synthesis</FormHelperText>
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
