import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Checkbox, Divider } from '@mui/joy';

import { GoodModal } from '~/common/components/GoodModal';
import { runWhenIdle } from '~/common/util/pwaUtils';
import { useOptimaLayout } from '~/common/layout/optima/useOptimaLayout';

import { DModelSource, DModelSourceId, useModelsStore } from '../store-llms';
import { createModelSourceForDefaultVendor, findVendorById } from '../vendors/vendors.registry';

import { LLMOptionsModal } from './LLMOptionsModal';
import { ModelsList } from './ModelsList';
import { ModelsSourceSelector } from './ModelsSourceSelector';


function VendorSourceSetup(props: { source: DModelSource }) {
  const vendor = findVendorById(props.source.vId);
  if (!vendor)
    return 'Configuration issue: Vendor not found for Source ' + props.source.id;
  return <vendor.SourceSetupComponent key={props.source.id} sourceId={props.source.id} />;
}


export function ModelsModal(props: { suspendAutoModelsSetup?: boolean }) {

  // local state
  const [_selectedSourceId, setSelectedSourceId] = React.useState<DModelSourceId | null>(null);
  const [showAllSources, setShowAllSources] = React.useState<boolean>(false);

  // external state
  const {
    closeLlmOptions, closeModelsSetup,
    openLlmOptions, openModelsSetup,
    showLlmOptions, showModelsSetup,
  } = useOptimaLayout();
  const { modelSources, llmCount } = useModelsStore(state => ({
    modelSources: state.sources,
    llmCount: state.llms.length,
  }), shallow);

  // auto-select the first source - note: we could use a useEffect() here, but this is more efficient
  // also note that state-persistence is unneeded
  const selectedSourceId = _selectedSourceId ?? modelSources[modelSources.length - 1]?.id ?? null;

  const activeSource = modelSources.find(source => source.id === selectedSourceId);

  const multiSource = modelSources.length > 1;

  // Auto-open this dialog - anytime no source is selected
  const autoOpenTrigger = !selectedSourceId && !props.suspendAutoModelsSetup;
  React.useEffect(() => {
    if (autoOpenTrigger)
      return runWhenIdle(openModelsSetup, 2000);
  }, [autoOpenTrigger, openModelsSetup]);

  // Auto-add the default source - at boot, when no source is present
  const autoAddTrigger = showModelsSetup && !props.suspendAutoModelsSetup;
  React.useEffect(() => {
    // Note: we use the immediate version to not react to deletions
    const { addSource, sources } = useModelsStore.getState();
    if (autoAddTrigger && !sources.length)
      addSource(createModelSourceForDefaultVendor(sources));
  }, [autoAddTrigger]);


  return <>

    {/* Sources Setup */}
    {showModelsSetup && <GoodModal
      title={<>Configure <b>AI Models</b></>}
      startButton={
        multiSource ? <Checkbox
          label='All Services' sx={{ my: 'auto' }}
          checked={showAllSources} onChange={() => setShowAllSources(all => !all)}
        /> : undefined
      }
      open onClose={closeModelsSetup}
      sx={{
        // forces some shrinkage of the contents (ModelsList)
        overflow: 'auto',
      }}
    >

      <ModelsSourceSelector selectedSourceId={selectedSourceId} setSelectedSourceId={setSelectedSourceId} />

      {!!activeSource && <Divider />}

      {!!activeSource && (
        <Box sx={{ display: 'grid', gap: 'var(--Card-padding)' }}>
          <VendorSourceSetup source={activeSource} />
        </Box>
      )}

      {!!llmCount && <Divider />}

      {!!llmCount && (
        <ModelsList
          filterSourceId={showAllSources ? null : selectedSourceId}
          onOpenLLMOptions={openLlmOptions}
          sx={{
            // works in tandem with the parent (GoodModal > Dialog) overflow: 'auto'
            minHeight: '6rem',
            overflowY: 'auto',

            // style (list variant=outlined)
            '--ListItem-paddingY': '0rem',
            '--ListItem-paddingRight': '0.5rem', // instead of 0.75
            backgroundColor: 'rgb(var(--joy-palette-neutral-lightChannel) / 20%)',
            borderRadius: 'md',

            // [mobile] a bit less padding
            '@media (max-width: 900px)': {
              '--ListItem-paddingLeft': '0.5rem',
              '--ListItem-paddingRight': '0.25rem',
            },
          }}
        />
      )}

      <Divider />

    </GoodModal>}

    {/* per-LLM options */}
    {!!showLlmOptions && <LLMOptionsModal id={showLlmOptions} onClose={closeLlmOptions} />}

  </>;
}