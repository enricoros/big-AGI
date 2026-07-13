import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Box, Button, FormControl, Typography } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import LinkIcon from '@mui/icons-material/Link';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import { ExpanderSection } from '~/common/components/ExpanderSection';
import { FormChipControl } from '~/common/components/forms/FormChipControl';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSecretField } from '~/common/components/forms/FormSecretField';
import { FormSliderControl } from '~/common/components/forms/FormSliderControl';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import type { DCredentialsApiKey, DSpeexEngine, DSpeexEngineAny, DSpeexVendorType, DVoiceElevenLabs, DVoiceInworld, DVoiceLocalAI, DVoiceOpenAI, DVoiceWebSpeech } from '../speex.types';
import { SPEEX_DEFAULTS, SPEEX_PREVIEW_STREAM, SPEEX_PREVIEW_TEXT } from '../speex.config';
import { SpeexVoiceAutocomplete } from './SpeexVoiceAutocomplete';
import { SpeexVoiceSelect } from './SpeexVoiceSelect';
import { speakText } from '../speex.client';
import { speexAreCredentialsValid } from '../store-module-speex';
import { speexVendorTypeLabel } from './SpeexEngineSelect';


function CredentialsApiKeyInputs({ credentials, onUpdate, vendorType, showHost, hostRequired, hostPlaceholder, keyPlaceholder }: {
  credentials: DCredentialsApiKey;
  onUpdate: (credentials: DCredentialsApiKey) => void;
  vendorType: DSpeexVendorType;
  showHost?: boolean;
  hostRequired?: boolean;
  hostPlaceholder?: string;
  keyPlaceholder?: string;
}) {
  return <>

    <FormSecretField
      autoCompleteId={`tts-${vendorType}-key`}
      title='API Key'
      description={hostRequired ? 'Optional' : speexVendorTypeLabel(vendorType)}
      placeholder={keyPlaceholder}
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

  </>;
}


function PreviewButton({ engineId }: { engineId: DSpeexEngineAny['engineId'] }) {

  // async + cache
  const queryClient = useQueryClient();
  const { isFetching, isError, error, refetch: previewVoice } = useQuery({
    enabled: false, // manual trigger only
    queryKey: ['speex-preview', engineId],
    queryFn: async ({ signal }) => {
      const result = await speakText(
        SPEEX_PREVIEW_TEXT,
        { engineId: engineId },
        { label: 'Engine preview', rpcDisableStreaming: !SPEEX_PREVIEW_STREAM },
        signal,
      );
      if (!result.success && !signal.aborted) throw new Error(result.errorText || 'Preview failed');
      return result;
    },
  });

  return (
    <TooltipOutlined color='danger' title={error?.message ? <div style={{ whiteSpace: 'pre-wrap' }}>{error.message}</div> : false}>
      <Button
        variant={isFetching ? 'soft' : 'outlined'}
        color={isError ? 'danger' : isFetching ? 'primary' : 'neutral'}
        size='sm'
        onClick={() => !isFetching ? previewVoice() : queryClient.cancelQueries({ queryKey: ['speex-preview', engineId] })}
        // disabled={isFetching}
        startDecorator={isFetching ? <StopRoundedIcon /> : <PlayArrowRoundedIcon />}
        sx={{ ml: 'auto', minWidth: 130 }}
      >
        {isFetching ? 'Speaking...' : isError ? 'Retry' : 'Preview'}
      </Button>
    </TooltipOutlined>
  );
}


// --- styles ---

const _styles = {
  sectionBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5,
    pt: 1,
    pb: 1,
  },
  bottomRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  advancedToggle: {
    textDecoration: 'underline',
    cursor: 'pointer',
    color: 'text.tertiary',
  },
} as const;


export function SpeexConfigureEngineFull(props: {
  engine: DSpeexEngineAny;
  isMobile: boolean;
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
}) {
  const { engine, isMobile, onUpdate } = props;

  const isLinked = engine.isAutoLinked;
  const isSystem = engine.isAutoDetected && !engine.isAutoLinked;
  const isManual = !isLinked && !isSystem;
  const isInvalid = !speexAreCredentialsValid(engine.credentials);

  // manual credentials (api-key) - null for linked/system engines
  const manualCredentials = isManual && engine.credentials.type === 'api-key' ? engine.credentials : null;

  // Advanced toggle: vendors with an optional API host keep it behind Advanced;
  // LocalAI requires the host and always shows it, Inworld has no host option
  const hasAdvancedHost = !!manualCredentials && (engine.vendorType === 'elevenlabs' || engine.vendorType === 'openai');
  const advanced = useToggleableBoolean(!!manualCredentials?.apiHost);

  const handleCredentialsUpdate = React.useCallback((credentials: DCredentialsApiKey) => {
    onUpdate({ credentials });
  }, [onUpdate]);


  // Service-access title reflects the engine's source + validity
  const accessTitle =
    isLinked ? 'Linked to AI Service'
      : isSystem ? 'System'
        : isInvalid ? 'Credentials (required)'
          : 'Credentials';

  // Access decorator (icon)
  const accessIcon =
    isLinked ? <LinkIcon fontSize='small' sx={{ opacity: 0.5 }} />
      : isSystem ? null
        : isInvalid ? <KeyIcon fontSize='small' sx={{ color: 'danger.solidBg' }} />
          : <KeyIcon fontSize='small' sx={{ opacity: 0.5 }} />;

  return <>

    {/* 1. Voice Parameters - defaults OPEN, user can collapse */}
    {/* Box wrap collapses the ExpanderSection fragment (header + content) into a single
        parent-grid cell so the Topic's grid gap only applies between sections. */}
    <div>
      <ExpanderSection
        title={`${engine.label} synthesis`}
        initialExpanded={true}
        persistentDivider
      >
        <Box sx={_styles.sectionBody}>

          {engine.vendorType === 'elevenlabs' ? (
            <ElevenLabsConfig engine={engine} onUpdate={onUpdate} isMobile={isMobile} />
          ) : engine.vendorType === 'inworld' ? (
            <InworldConfig engine={engine} onUpdate={onUpdate} isMobile={isMobile} />
          ) : engine.vendorType === 'localai' ? (
            <LocalAIConfig engine={engine} onUpdate={onUpdate} isMobile={isMobile} />
          ) : engine.vendorType === 'openai' ? (
            <OpenAIConfig engine={engine} onUpdate={onUpdate} isMobile={isMobile} />
          ) : engine.vendorType === 'webspeech' ? (
            <WebSpeechConfig engine={engine} onUpdate={onUpdate} isMobile={isMobile} />
          ) : (
            <Typography level='body-sm' color='warning'>Unknown engine type {(engine as any)?.vendorType}</Typography>
          )}

          {/* Preview the configured voice */}
          <Box sx={_styles.bottomRow}>
            <PreviewButton engineId={engine.engineId} />
          </Box>

        </Box>
      </ExpanderSection>
    </div>

    {/* 2. Service Access - defaults CLOSED, auto-opens when credentials invalid */}
    <Box>
      <ExpanderSection
        title={accessTitle}
        initialExpanded={isInvalid}
        expandRequest={isInvalid ? true : undefined}
        startDecorator={accessIcon}
        persistentDivider
      >
        <Box sx={_styles.sectionBody}>

          {isLinked && (
            <Typography level='body-xs'>
              Credentials inherited from your {engine.label} LLM service. Manage in Chat &gt; AI Services.
            </Typography>
          )}

          {isSystem && (
            <Typography level='body-xs'>
              System-provided voice. No configuration needed.
            </Typography>
          )}

          {manualCredentials && (
            <CredentialsApiKeyInputs
              credentials={manualCredentials}
              onUpdate={handleCredentialsUpdate}
              vendorType={engine.vendorType}
              showHost={engine.vendorType === 'localai' || (hasAdvancedHost && advanced.on)}
              hostRequired={engine.vendorType === 'localai'}
              hostPlaceholder={
                engine.vendorType === 'localai' ? 'http://localhost:8080'
                  : engine.vendorType === 'elevenlabs' ? 'https://api.elevenlabs.io'
                    : 'https://api.openai.com'
              }
              keyPlaceholder={engine.vendorType === 'inworld' ? 'Base64-key' : undefined}
            />
          )}

          {/* Advanced toggle (manual only, vendors with an optional host) */}
          {hasAdvancedHost && (
            <Box sx={_styles.bottomRow}>
              <Typography
                level='body-xs'
                onClick={advanced.toggle}
                sx={_styles.advancedToggle}
              >
                {advanced.on ? 'Hide Advanced' : 'Advanced'}
              </Typography>
            </Box>
          )}

        </Box>
      </ExpanderSection>
    </Box>

  </>;
}


// Vendor-specific configs

function ElevenLabsConfig({ engine, onUpdate, isMobile }: {
  engine: DSpeexEngine<'elevenlabs'>,
  onUpdate: (updates: Partial<DSpeexEngine<'elevenlabs'>>) => void;
  isMobile: boolean;
}) {

  const { voice } = engine;

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

  </>;
}


function InworldConfig({ engine, onUpdate, isMobile }: {
  engine: DSpeexEngine<'inworld'>,
  onUpdate: (updates: Partial<DSpeexEngine<'inworld'>>) => void;
  isMobile: boolean;
}) {

  const { voice } = engine;

  const handleVoiceChange = React.useCallback((ttsVoiceId: DVoiceInworld['ttsVoiceId']) => {
    const { ttsVoiceId: _, ...restVoice } = voice;
    onUpdate({
      voice: {
        ...restVoice,
        ...(ttsVoiceId && { ttsVoiceId }),
      },
    });
  }, [onUpdate, voice]);

  const handleSpeedChange = React.useCallback((value: number) => {
    onUpdate({ voice: { ...voice, ttsSpeakingRate: value } });
  }, [onUpdate, voice]);

  return <>

    <FormChipControl<Exclude<DVoiceInworld['ttsModel'], undefined>>
      title='Model'
      alignEnd
      options={[
        { value: 'inworld-tts-1.5-max', label: 'TTS 1.5 Max', description: 'Quality' },
        { value: 'inworld-tts-1.5-mini', label: 'TTS 1.5 Mini', description: 'Fast' },
      ]}
      value={voice.ttsModel ?? SPEEX_DEFAULTS.INWORLD_MODEL}
      onChange={(value) => onUpdate({ voice: { ...voice, ttsModel: value } })}
    />

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden' }}>
      <FormLabelStart title='Voice' description={isMobile ? undefined : 'Inworld voice'} />
      <SpeexVoiceSelect
        autoPreview
        engine={engine}
        voiceId={voice.ttsVoiceId ?? null}
        onVoiceChange={handleVoiceChange}
      />
    </FormControl>

    <FormSliderControl
      title='Speed'
      description={`${voice.ttsSpeakingRate ?? 1}x`}
      min={0.5}
      max={1.5}
      step={0.1}
      value={voice.ttsSpeakingRate ?? 1}
      onChange={handleSpeedChange}
      valueLabelDisplay={voice.ttsSpeakingRate && voice.ttsSpeakingRate !== 1 ? 'on' : 'auto'}
      sliderSx={{ maxWidth: 220, my: -0.5 }}
    />

  </>;
}


function LocalAIConfig({ engine, onUpdate, isMobile }: {
  engine: DSpeexEngine<'localai'>,
  onUpdate: (updates: Partial<DSpeexEngine<'localai'>>) => void;
  isMobile: boolean;
}) {
  const { voice } = engine;

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


function OpenAIConfig({ engine, onUpdate, isMobile }: {
  engine: DSpeexEngine<'openai'>,
  onUpdate: (updates: Partial<DSpeexEngineAny>) => void;
  isMobile: boolean;
}) {

  const { voice } = engine;

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
