import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Checkbox, Divider } from '@mui/joy';

import { DModelSource, DModelSourceId, useModelsStore } from '~/modules/llms/store-llms';
import { createModelSourceForDefaultVendor, findVendorById } from '~/modules/llms/vendors/vendor.registry';

import { GoodModal } from '~/common/components/GoodModal';
import { closeLayoutModelsSetup, openLayoutModelsSetup, useLayoutModelsSetup } from '~/common/layout/store-applayout';
import { settingsGap } from '~/common/app.theme';

import { LLMOptionsModal } from './LLMOptionsModal';
import { ModelsList } from './ModelsList';
import { ModelsSourceSelector } from './ModelsSourceSelector';


function VendorSourceSetup(props: { source: DModelSource }) {
  const vendor = findVendorById(props.source.vId);
  if (!vendor)
    return 'Configuration issue: Vendor not found for Source ' + props.source.id;
  return <vendor.SourceSetupComponent sourceId={props.source.id} />;
}


export function ModelsModal(props: { suspendAutoModelsSetup?: boolean }) {

  // local state
  const [_selectedSourceId, setSelectedSourceId] = React.useState<DModelSourceId | null>(null);
  const [showAllSources, setShowAllSources] = React.useState<boolean>(false);

  // external state
  const [modelsSetupOpen, llmOptionsId] = useLayoutModelsSetup();
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
      openLayoutModelsSetup();
  }, [selectedSourceId, props.suspendAutoModelsSetup]);

  // add the default source on cold - will require setup
  React.useEffect(() => {
    const { addSource, sources } = useModelsStore.getState();
    if (!sources.length && !props.suspendAutoModelsSetup)
      addSource(createModelSourceForDefaultVendor(sources));
  }, [props.suspendAutoModelsSetup]);


  return <>

    {/* Sources Setup */}
    {modelsSetupOpen && <GoodModal
      title={<>Configure <b>AI Models</b></>}
      startButton={
        multiSource ? <Checkbox
          label='all vendors' sx={{ my: 'auto' }}
          checked={showAllSources} onChange={() => setShowAllSources(all => !all)}
        /> : undefined
      }
      open onClose={closeLayoutModelsSetup}
    >

      <ModelsSourceSelector selectedSourceId={selectedSourceId} setSelectedSourceId={setSelectedSourceId} />

      {!!activeSource && <Divider />}

      {!!activeSource && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: settingsGap }}>
          <VendorSourceSetup source={activeSource} />
        </Box>
      )}

      {!!llmCount && <Divider />}

      {!!llmCount && <ModelsList filterSourceId={showAllSources ? null : selectedSourceId} />}

      <Divider />

    </GoodModal>}

    {/* per-LLM options */}
    {!!llmOptionsId && <LLMOptionsModal id={llmOptionsId} />}

  </>;
}