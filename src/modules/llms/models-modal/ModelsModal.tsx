import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Checkbox, Divider } from '@mui/joy';

import { GoodModal } from '~/common/components/GoodModal';
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
  const selectedSourceId = _selectedSourceId ?? modelSources[0]?.id ?? null;

  const activeSource = modelSources.find(source => source.id === selectedSourceId);

  const multiSource = modelSources.length > 1;

  // if no sources at startup, open the modal
  React.useEffect(() => {
    if (!selectedSourceId && !props.suspendAutoModelsSetup)
      openModelsSetup();
  }, [selectedSourceId, props.suspendAutoModelsSetup, openModelsSetup]);

  // add the default source on cold - will require setup
  React.useEffect(() => {
    const { addSource, sources } = useModelsStore.getState();
    if (!sources.length && !props.suspendAutoModelsSetup)
      addSource(createModelSourceForDefaultVendor(sources));
  }, [props.suspendAutoModelsSetup]);


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
          }}
        />
      )}

      <Divider />

    </GoodModal>}

    {/* per-LLM options */}
    {!!showLlmOptions && <LLMOptionsModal id={showLlmOptions} onClose={closeLlmOptions} />}

  </>;
}