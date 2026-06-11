import * as React from 'react';

import { Box, Typography } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import LinkIcon from '@mui/icons-material/Link';

import { ExpanderSection } from '~/common/components/ExpanderSection';
import { FormChipControl } from '~/common/components/forms/FormChipControl';
import { FormSecretField } from '~/common/components/forms/FormSecretField';
import { FormSliderControl } from '~/common/components/forms/FormSliderControl';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import type { DASRxEngine, DASRxEngineAny, DASRxVendorType, DCredentialsApiKey, DProfileDeepgram, DProfileOpenAI } from '../asrx.types';
import { ASRX_DEFAULTS } from '../asrx.config';
import { asrxAreCredentialsValid } from '../store-module-asrx';


// --- Public component ---

export function ASRxConfigureEngineFull(props: {
  engine: DASRxEngineAny;
  isMobile: boolean;
  onUpdate: (updates: Partial<DASRxEngineAny>) => void;
}) {
  const { engine, isMobile, onUpdate } = props;

  const isLinked = engine.isAutoLinked;
  const isSystem = engine.isAutoDetected && !engine.isAutoLinked;
  const isManual = !isLinked && !isSystem;
  const isInvalid = !asrxAreCredentialsValid(engine.credentials);

  // Advanced toggle (manual only) lifted here so it can share the bottom row with Delete
  const manualHasHost = isManual && engine.credentials.type === 'api-key' && !!engine.credentials.apiHost;
  const advanced = useToggleableBoolean(manualHasHost);


  // Service-access title reflects the engine's source + validity
  const accessTitle =
    isLinked ? 'Linked to AI Service'
      : isSystem ? 'System'
        : isInvalid ? 'Credentials (required)'
          : 'Credentials';

  // Access decorator (icon)
  const accessIcon =
    isLinked ? <LinkIcon fontSize='small' sx={{ opacity: 0.5 }} />
      : isInvalid ? <KeyIcon fontSize='small' sx={{ color: 'danger.solidBg' }} />
        : <KeyIcon fontSize='small' sx={{ opacity: 0.5 }}/>;

  return <>

    {/* 1. Transcription Parameters - defaults OPEN, user can collapse */}
    {/* Box wrap collapses the ExpanderSection fragment (header + content) into a single
        parent-grid cell so the Topic's grid gap only applies between sections. */}
    <div>
      <ExpanderSection
        title={`${engine.label} options`}
        initialExpanded={true}
        persistentDivider
      >
        <Box sx={_styles.sectionBody}>
          {engine.vendorType === 'deepgram' ? (
            <DeepgramParameters engine={engine} onUpdate={onUpdate} />
          ) : engine.vendorType === 'openai' ? (
            <OpenAIParameters engine={engine} onUpdate={onUpdate} isMobile={isMobile} />
          ) : (
            <Typography level='body-sm' color='warning'>Unknown engine type {(engine as any)?.vendorType}</Typography>
          )}
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
              System-provided engine. No configuration needed.
            </Typography>
          )}

          {isManual && engine.credentials.type === 'api-key' && (
            <ManualCredentials
              engine={engine}
              credentials={engine.credentials}
              onUpdate={onUpdate}
              advancedOn={advanced.on}
            />
          )}

          {/* Advanced toggle (manual only) */}
          {isManual && (
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


// --- Manual credentials (api-key + optional host) ---

function ManualCredentials({ engine, credentials, onUpdate, advancedOn }: {
  engine: DASRxEngineAny;
  credentials: DCredentialsApiKey;
  onUpdate: (updates: Partial<DASRxEngineAny>) => void;
  advancedOn: boolean;
}) {

  const vendorType: DASRxVendorType = engine.vendorType;

  const handleCredentialsUpdate = React.useCallback((patch: Partial<DCredentialsApiKey>) => {
    onUpdate({ credentials: { ...credentials, ...patch } as DCredentialsApiKey });
  }, [credentials, onUpdate]);

  // const keyDescription = vendorType === 'deepgram' ? 'Deepgram' : 'OpenAI';
  const hostDefault = vendorType === 'deepgram' ? 'https://api.deepgram.com' : 'https://api.openai.com';

  return <>

    <FormSecretField
      autoCompleteId={`asrx-${vendorType}-key`}
      title='API Key'
      // description={keyDescription}
      value={credentials.apiKey}
      onChange={value => handleCredentialsUpdate({ apiKey: value })}
      required
      startDecorator={credentials.apiKey ? false : undefined}
      inputSx={{ maxWidth: 210 }}
    />

    {advancedOn && (
      <FormTextField
        autoCompleteId={`asrx-${vendorType}-host`}
        title='API Host'
        description='Optional'
        value={credentials.apiHost ?? ''}
        onChange={text => handleCredentialsUpdate({ apiHost: text || undefined })}
        placeholder={hostDefault}
        inputSx={{ maxWidth: 210 }}
      />
    )}

  </>;
}


// --- Deepgram parameters ---

function DeepgramParameters({ engine, onUpdate }: {
  engine: DASRxEngine<'deepgram'>;
  onUpdate: (updates: Partial<DASRxEngine<'deepgram'>>) => void;
}) {

  const { profile } = engine;

  const handleProfileUpdate = React.useCallback((patch: Partial<DProfileDeepgram>) => {
    onUpdate({ profile: { ...profile, ...patch } });
  }, [onUpdate, profile]);

  return <>

    {/* Model */}
    <FormChipControl<string>
      title='Model'
      alignEnd
      options={[
        { value: 'nova-3', label: 'Nova 3', description: 'Latest' },
        { value: 'nova-2', label: 'Nova 2', description: 'Stable' },
      ]}
      value={profile.asrModel ?? ASRX_DEFAULTS.DEEPGRAM_MODEL}
      onChange={value => handleProfileUpdate({ asrModel: value })}
    />

    {/* Language */}
    <FormTextField
      autoCompleteId='asrx-deepgram-language'
      title='Language'
      description='multi, en, es, ..'
      placeholder={ASRX_DEFAULTS.DEEPGRAM_LANGUAGE}
      value={profile.language ?? ''}
      onChange={text => handleProfileUpdate({ language: text || undefined })}
      inputSx={{ maxWidth: 80 }}
    />

    {/* Processing features */}
    <FormSwitchControl
      title='Smart Format'
      description='Punctuation, numbers, dates'
      checked={profile.smartFormat !== false}
      onChange={checked => handleProfileUpdate({ smartFormat: checked })}
    />

    <FormSwitchControl
      title='Diarize'
      description='Speaker labels'
      checked={!!profile.diarize}
      onChange={checked => handleProfileUpdate({ diarize: checked || undefined })}
    />

  </>;
}


// --- OpenAI parameters ---

function OpenAIParameters({ engine, onUpdate, isMobile }: {
  engine: DASRxEngine<'openai'>;
  onUpdate: (updates: Partial<DASRxEngineAny>) => void;
  isMobile: boolean;
}) {

  const { profile } = engine;
  const isWhisper = (profile.asrModel ?? ASRX_DEFAULTS.OPENAI_MODEL) === 'whisper-1';

  const handleProfileUpdate = React.useCallback((patch: Partial<DProfileOpenAI>) => {
    onUpdate({ profile: { ...profile, ...patch } });
  }, [onUpdate, profile]);

  return <>

    {/* Model */}
    <FormChipControl<Exclude<DProfileOpenAI['asrModel'], undefined>>
      title='Model'
      alignEnd
      options={[
        { value: 'gpt-4o-transcribe', label: 'GPT-4o', description: 'Latest' },
        { value: 'gpt-4o-mini-transcribe', label: 'GPT-4o mini', description: 'Cheap' },
        { value: 'whisper-1', label: 'Whisper', description: 'Legacy' },
      ]}
      value={profile.asrModel ?? ASRX_DEFAULTS.OPENAI_MODEL}
      onChange={value => handleProfileUpdate({ asrModel: value })}
    />

    {/* Language */}
    <FormTextField
      autoCompleteId='asrx-openai-language'
      title='Language'
      description={isMobile ? undefined : 'ISO-639-1, blank = auto'}
      placeholder='(auto-detect)'
      value={profile.language ?? ''}
      onChange={text => handleProfileUpdate({ language: text || undefined })}
      inputSx={{ maxWidth: 210 }}
    />

    {/* Prompt */}
    <FormTextField
      autoCompleteId='asrx-openai-prompt'
      title='Prompt'
      description={isMobile ? undefined : 'Vocabulary / style hint'}
      placeholder='Optional - e.g. names or jargon'
      value={profile.prompt ?? ''}
      onChange={text => handleProfileUpdate({ prompt: text || undefined })}
      inputSx={{ maxWidth: 210 }}
    />

    {/* Temperature (whisper-1 only) */}
    {isWhisper && (
      <FormSliderControl
        title='Temperature'
        description={`${(profile.temperature ?? 0).toFixed(1)} (whisper-1)`}
        min={0}
        max={1}
        step={0.1}
        value={profile.temperature ?? 0}
        onChange={value => handleProfileUpdate({ temperature: value || undefined })}
        valueLabelDisplay={profile.temperature ? 'on' : 'auto'}
        sliderSx={{ maxWidth: 220, my: -0.5 }}
      />
    )}

  </>;
}
