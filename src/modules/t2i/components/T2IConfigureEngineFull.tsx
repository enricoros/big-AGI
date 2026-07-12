import * as React from 'react';

import { Box, Typography } from '@mui/joy';
// import KeyIcon from '@mui/icons-material/Key';
// import LinkIcon from '@mui/icons-material/Link';

import { ExpanderSection } from '~/common/components/ExpanderSection';

import type { TextToImageProvider } from '~/common/components/useCapabilities';

import { t2iVendorConfigPanel } from './T2IConfigureEngines';


// --- Public component ---

export function T2IConfigureEngineFull(props: {
  provider: TextToImageProvider;
  isMobile: boolean;
}) {
  const { provider } = props;

  // source discrimination: today every engine is auto-linked to an LLM service;
  // manual (api-key) and system-provided engines will discriminate here later
  const isLinked = !!provider.modelServiceId;

  const ConfigPanel = t2iVendorConfigPanel(provider.vendor);


  // for the future Service Access expander (see below):
  // const accessTitle = isLinked ? 'Linked to AI Service' : 'Credentials';
  // const accessIcon = isLinked ? <LinkIcon fontSize='small' sx={{ opacity: 0.5 }} /> : <KeyIcon fontSize='small' sx={{ opacity: 0.5 }} />;

  return <>

    {/* 1. Generation Parameters - static section, not collapsible */}
    {/* Box wrap collapses the ExpanderSection fragment (header + content) into a single
        parent-grid cell so the Topic's grid gap only applies between sections. */}
    <div>
      <ExpanderSection
        title={`${provider.label} options`}
        isCollapsible={false}
        initialExpanded={true}
        persistentDivider
      >
        <Box sx={_styles.sectionBody}>
          {ConfigPanel ? (
            <ConfigPanel />
          ) : (
            <Typography level='body-sm'>No engine-specific options.</Typography>
          )}
        </Box>
      </ExpanderSection>
    </div>

    {/* 2. Service Access - plain text while all engines are LLM-service-linked;
        restore the ExpanderSection below when manual (api-key) engines arrive */}
    <Typography level='body-xs'>
      {isLinked
        ? <>Credentials inherited from your {provider.label} LLM service. Manage in Chat &gt; AI Services.</>
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
