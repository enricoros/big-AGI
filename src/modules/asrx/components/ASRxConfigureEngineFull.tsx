import * as React from 'react';

import { Box, Button, FormControl, Link, Textarea, Typography } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import LinkIcon from '@mui/icons-material/Link';

import { ExpanderSection } from '~/common/components/ExpanderSection';
import { FormChipControl } from '~/common/components/forms/FormChipControl';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSecretField } from '~/common/components/forms/FormSecretField';
import { FormSliderControl } from '~/common/components/forms/FormSliderControl';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import type { DASRxEngine, DASRxEngineAny, DASRxVendorType, DCredentialsApiKey, DProfileDeepgram, DProfileOpenAI } from '../asrx.types';
import { ASRX_DEFAULTS } from '../asrx.config';
import { ASRxVendorDeepgram } from '../vendors/deepgram.vendor';
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
        title={`${engine.label} transcription`}
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
    lineHeight: 2, // makes the whole line be 24px
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

  // state
  const [dictionaryOpen, setDictionaryOpen] = React.useState(false);

  // advanced features start open when any is already configured
  const advanced = useToggleableBoolean(!!profile.diarize || !!profile.topics || !!profile.sentiment || !!profile.keyterms?.length);


  const handleProfileUpdate = React.useCallback((patch: Partial<DProfileDeepgram>) => {
    onUpdate({ profile: { ...profile, ...patch } });
  }, [onUpdate, profile]);

  // any parameter off its default (the dictionary is data, not a parameter - reset never touches it)
  const hasUserParameters =
    (profile.asrModel !== undefined && profile.asrModel !== ASRX_DEFAULTS.DEEPGRAM_MODEL)
    || (profile.language !== undefined && profile.language !== ASRX_DEFAULTS.DEEPGRAM_LANGUAGE)
    || profile.smartFormat === false
    || !!profile.diarize || !!profile.utterances || !!profile.topics || !!profile.sentiment;

  const handleResetParameters = React.useCallback(() => {
    onUpdate({ profile: { ...ASRxVendorDeepgram.getDefaultProfile(), ...(profile.keyterms?.length && { keyterms: profile.keyterms }) } });
  }, [onUpdate, profile.keyterms]);

  const termsCount = profile.keyterms?.length ?? 0;

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
      description={
        <Link level='inherit' color='neutral' href='https://developers.deepgram.com/docs/models-languages-overview' target='_blank' rel='noopener' sx={{ textDecoration: 'underline' }}>
          multi, en, es, ..
        </Link>
      }
      placeholder={ASRX_DEFAULTS.DEEPGRAM_LANGUAGE}
      value={profile.language ?? ''}
      onChange={text => handleProfileUpdate({ language: text || undefined })}
      inputSx={{ maxWidth: 80 }}
    />

    {/* Processing features */}
    <FormSwitchControl
      title='Smart Format'
      description='Punctuation, paragraphs'
      checked={profile.smartFormat !== false}
      onChange={checked => handleProfileUpdate({ smartFormat: checked })}
    />

    {advanced.on && <>

      <FormSwitchControl
        title='Label Topics'
        description='Detects subject changes'
        checked={!!profile.topics}
        onChange={checked => handleProfileUpdate({ topics: checked || undefined })}
      />

      <FormSwitchControl
        title='Label Sentiment'
        description='Overall tone'
        checked={!!profile.sentiment}
        onChange={checked => handleProfileUpdate({ sentiment: checked || undefined })}
      />

      <FormSwitchControl
        title='Label Speakers'
        description='Speaker 0: Hi...'
        checked={!!profile.diarize}
        onChange={checked => handleProfileUpdate({ diarize: checked || undefined })}
      />

      {/* User Dictionary - the term list lives in a small editor modal */}
      <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title='Personal Dictionary' description='Fix names & jargon' />
        <Button variant='outlined' color='neutral' onClick={() => setDictionaryOpen(true)}>
          {termsCount ? `${termsCount} term${termsCount === 1 ? '' : 's'}` : 'Add terms...'}
        </Button>
      </FormControl>

    </>}

    {/* Advanced toggle on the left; reset link on the right, only when off-default */}
    <Box sx={_styles.bottomRow}>
      <Typography
        level='body-xs'
        onClick={advanced.toggle}
        sx={{ ..._styles.advancedToggle, mr: 'auto' }}
      >
        {advanced.on ? 'Hide Advanced' : 'Advanced...'}
      </Typography>
      {hasUserParameters && (
        <Link
          component='button'
          color='neutral'
          level='body-xs'
          onClick={handleResetParameters}
        >
          Reset to defaults ...
        </Link>
      )}
    </Box>

    {dictionaryOpen && (
      <DeepgramDictionaryModal
        terms={profile.keyterms ?? []}
        onSave={terms => {
          handleProfileUpdate({ keyterms: terms.length ? terms : undefined });
          setDictionaryOpen(false);
        }}
        onClose={() => setDictionaryOpen(false)}
      />
    )}

  </>;
}


/** Minimal one-term-per-line editor for the Deepgram user dictionary. */
function DeepgramDictionaryModal(props: {
  terms: string[];
  onSave: (terms: string[]) => void;
  onClose: () => void;
}) {

  // state
  const [text, setText] = React.useState(() => props.terms.join('\n'));

  const { onSave } = props;

  const handleSave = React.useCallback(() => {
    // one term per line - trimmed, deduped (case-insensitive), never empty; capped at 100 terms of 100 utf-8 bytes each
    const utf8 = new TextEncoder();
    const seen = new Set<string>();
    const terms: string[] = [];
    for (const line of text.split('\n')) {
      const term = line.trim();
      if (!term || seen.has(term.toLowerCase()) || utf8.encode(term).length > 100) continue;
      seen.add(term.toLowerCase());
      terms.push(term);
      if (terms.length >= 100) break;
    }
    onSave(terms);
  }, [onSave, text]);

  return (
    <GoodModal
      open
      title='Personal Dictionary'
      closeText='Cancel'
      onClose={props.onClose}
      startButton={<Button onClick={handleSave}>Save</Button>}
    >
      <Typography level='body-sm'>
        One term per line, up to 100 terms. These are sent with every transcription to boost names, brands and jargon the engine keeps mis-hearing.
      </Typography>
      <Textarea
        autoFocus
        minRows={6}
        maxRows={16}
        placeholder={'Big-AGI\nBeam\n...'}
        value={text}
        onChange={event => setText(event.target.value)}
      />
    </GoodModal>
  );
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
