import * as React from 'react';

import { Box, Typography } from '@mui/joy';
// import KeyIcon from '@mui/icons-material/Key';
// import LinkIcon from '@mui/icons-material/Link';

import { ExpanderSection } from '~/common/components/ExpanderSection';

import type { DT2IEngineAny, DT2IEngineId } from '../t2i.types';
import { DallESettings } from '../dalle/DallESettings';
import { OpenRouterT2ISettings } from '../openrouter/OpenRouterT2ISettings';
import { useT2IStore } from '../store-module-t2i';


// --- Profile panel (vendor-specific) ---

/**
 * Vendor-specific configuration panel for a T2I engine's profile.
 * The openai, azure and localai vendors generate through the OpenAI/DALL·E
 * path and share a profile shape, so they share the DALL·E panel.
 */
function T2IEngineProfilePanel(props: {
  engine: DT2IEngineAny;
  onUpdate: (updates: Partial<DT2IEngineAny>) => void;
}) {
  const { engine, onUpdate } = props;

  const profile = engine.profile;
  switch (profile.dialect) {
    case 'dalle':
      return (
        <DallESettings
          profile={profile}
          onUpdateProfile={update => onUpdate({ profile: { ...profile, ...update } })}
        />
      );
    case 'openrouter':
      return (
        <OpenRouterT2ISettings
          profile={profile}
          onUpdateProfile={update => onUpdate({ profile: { ...profile, ...update } })}
        />
      );
    default:
      return <Typography level='body-sm' color='warning'>Unknown engine type {(engine as any)?.vendorType}</Typography>;
  }
}


/**
 * Store-connected profile panel for a given engine id - used by the Draw app's
 * inline Options expander, which knows the active engine id but not the instance.
 */
export function T2IEngineProfileEditor(props: { engineId: DT2IEngineId | null }) {
  const { engineId } = props;
  const engine = useT2IStore(state => engineId ? state.engines[engineId] ?? null : null);
  if (!engine || engine.isDeleted) return null;
  return (
    <T2IEngineProfilePanel
      engine={engine}
      onUpdate={updates => useT2IStore.getState().updateEngine(engine.engineId, updates)}
    />
  );
}


// --- Public component ---

export function T2IConfigureEngineFull(props: {
  engine: DT2IEngineAny;
  isMobile: boolean;
  onUpdate: (updates: Partial<DT2IEngineAny>) => void;
}) {
  const { engine, onUpdate } = props;

  // source discrimination: today every engine is auto-linked to an LLM service;
  // manual (api-key) and system-provided engines will discriminate here later
  const isLinked = engine.credentials.type === 'llms-service';

  // for the future Service Access expander (see below):
  // const accessTitle = isLinked ? 'Linked to AI Service' : 'Credentials';
  // const accessIcon = isLinked ? <LinkIcon fontSize='small' sx={{ opacity: 0.5 }} /> : <KeyIcon fontSize='small' sx={{ opacity: 0.5 }} />;

  return <>

    {/* 1. Generation Parameters - static section, not collapsible */}
    {/* Box wrap collapses the ExpanderSection fragment (header + content) into a single
        parent-grid cell so the Topic's grid gap only applies between sections. */}
    <div>
      <ExpanderSection
        title={`${engine.label} image generation`}
        isCollapsible={false}
        initialExpanded={true}
        persistentDivider
      >
        <Box sx={_styles.sectionBody}>
          <T2IEngineProfilePanel engine={engine} onUpdate={onUpdate} />
        </Box>
      </ExpanderSection>
    </div>

    {/* 2. Service Access - plain text while all engines are LLM-service-linked;
        restore the ExpanderSection below when manual (api-key) engines arrive */}
    <Typography level='body-xs'>
      {isLinked
        ? <>Using credentials from your {engine.label} LLM service. Manage in Chat &gt; AI Services.</>
        : <>This engine is not linked to an AI Service.</>}
    </Typography>
    {/*<Box>*/}
    {/*  <ExpanderSection*/}
    {/*    title={accessTitle}*/}
    {/*    initialExpanded={false}*/}
    {/*    startDecorator={accessIcon}*/}
    {/*    persistentDivider*/}
    {/*  >*/}
    {/*    <Box sx={_styles.sectionBody}>*/}
    {/*      ... credentials inputs (api-key + host), as in ASRxConfigureEngineFull ...*/}
    {/*    </Box>*/}
    {/*  </ExpanderSection>*/}
    {/*</Box>*/}

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
} as const;
